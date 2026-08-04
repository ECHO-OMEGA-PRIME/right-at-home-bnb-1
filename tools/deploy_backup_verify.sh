#!/usr/bin/env bash
: <<'DEPLOY_DOC'
Deploy the RAH verified-backup release and systemd units on FORGE.

The production DIRECT_URL is intentionally outside this script and repo.  It
must already exist in /etc/rah-backup-verify.env as a root-owned 0600 file.
DEPLOY_DOC
set -Eeuo pipefail

[[ "${EUID}" -eq 0 ]] || { echo "run as root" >&2; exit 2; }

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
STAGED_DIR=${1:-$SCRIPT_DIR}
ENV_FILE=/etc/rah-backup-verify.env
ALERT_ENV_FILE=/etc/rah-backup-alert.env
INSTALL_ROOT=/opt/rah-backup-verify
UNIT_DIR=/etc/systemd/system
OPS_BACKUP_ROOT=/var/backups/rah-ops
UNITS=(
  echo-rah-backup-verify.service
  echo-rah-backup-verify.timer
  echo-rah-backup-alert@.service
  echo-rah-backup-silence.service
  echo-rah-backup-silence.timer
)
PAYLOAD=(
  backup_verify.sh
  backup_watchdog.py
  prepare_pg_client_env.py
  test_backup_watchdog.py
  test_prepare_pg_client_env.py
  BACKUP_VERIFY.md
)

for file in "${UNITS[@]}" "${PAYLOAD[@]}" deploy_backup_verify.sh; do
  [[ -f "${STAGED_DIR}/${file}" ]] || { echo "missing staged file: ${file}" >&2; exit 2; }
done
[[ -f "$ENV_FILE" ]] || { echo "missing required $ENV_FILE" >&2; exit 2; }
[[ "$(stat -c '%U:%G %a' "$ENV_FILE")" == "root:root 600" ]] || {
  echo "$ENV_FILE must be root:root mode 0600" >&2
  exit 2
}
grep -q '^DIRECT_URL=' "$ENV_FILE" || { echo "$ENV_FILE lacks DIRECT_URL" >&2; exit 2; }
grep -q '^RAH_VERIFY_PASSWORD=' "$ENV_FILE" || {
  echo "$ENV_FILE lacks RAH_VERIFY_PASSWORD" >&2
  exit 2
}
[[ -f "$ALERT_ENV_FILE" ]] || { echo "missing required $ALERT_ENV_FILE" >&2; exit 2; }
[[ "$(stat -c '%U:%G %a' "$ALERT_ENV_FILE")" == "root:root 600" ]] || {
  echo "$ALERT_ENV_FILE must be root:root mode 0600" >&2
  exit 2
}
grep -q '^RAH_BACKUP_TG_CHAT_ID=' "$ALERT_ENV_FILE" || {
  echo "$ALERT_ENV_FILE lacks RAH_BACKUP_TG_CHAT_ID" >&2
  exit 2
}

bash -n "${STAGED_DIR}/backup_verify.sh" "${STAGED_DIR}/deploy_backup_verify.sh"
python3 -m py_compile \
  "${STAGED_DIR}/backup_watchdog.py" \
  "${STAGED_DIR}/prepare_pg_client_env.py" \
  "${STAGED_DIR}/test_backup_watchdog.py" \
  "${STAGED_DIR}/test_prepare_pg_client_env.py"
python3 "${STAGED_DIR}/test_backup_watchdog.py"
python3 "${STAGED_DIR}/test_prepare_pg_client_env.py"
verify_dir=$(mktemp -d /tmp/rah-backup-unit-verify.XXXXXX)
cleanup_verify_dir() { rm -rf -- "$verify_dir"; }
trap cleanup_verify_dir EXIT
for unit in "${UNITS[@]}"; do
  cp "${STAGED_DIR}/${unit}" "${verify_dir}/${unit}"
done
sed -i \
  -e "s#/opt/rah-backup-verify/current/backup_verify.sh#${STAGED_DIR}/backup_verify.sh#" \
  -e "s#/opt/rah-backup-verify/current/backup_watchdog.py#${STAGED_DIR}/backup_watchdog.py#" \
  "${verify_dir}/"*.service
systemd-analyze verify "${verify_dir}/"*.service "${verify_dir}/"*.timer
cleanup_verify_dir
trap - EXIT

digest=$(
  sha256sum \
    "${STAGED_DIR}/backup_verify.sh" \
    "${STAGED_DIR}/backup_watchdog.py" \
    "${STAGED_DIR}/prepare_pg_client_env.py" |
    sha256sum | cut -c1-12
)
release="$(date -u +%Y%m%dT%H%M%SZ)-${digest}"
release_dir="${INSTALL_ROOT}/releases/${release}"
backup_dir="${OPS_BACKUP_ROOT}/$(date -u +%Y%m%dT%H%M%SZ)-${digest}"
previous_target=$(readlink -f "${INSTALL_ROOT}/current" 2>/dev/null || true)
activated=0
TIMERS=(echo-rah-backup-verify.timer echo-rah-backup-silence.timer)
declare -A prior_enabled prior_active
for timer in "${TIMERS[@]}"; do
  prior_enabled["$timer"]=$(systemctl is-enabled "$timer" 2>/dev/null || true)
  prior_active["$timer"]=$(systemctl is-active "$timer" 2>/dev/null || true)
done

mkdir -p "$release_dir" "$backup_dir"
chmod 0700 "$backup_dir"
for file in "${PAYLOAD[@]}"; do
  mode=0444
  case "$file" in
    *.sh|*.py) mode=0555 ;;
  esac
  install -o root -g root -m "$mode" "${STAGED_DIR}/${file}" "${release_dir}/${file}"
done
chmod 0555 "$release_dir"

for unit in "${UNITS[@]}"; do
  if [[ -e "${UNIT_DIR}/${unit}" ]]; then
    cp -a "${UNIT_DIR}/${unit}" "${backup_dir}/${unit}"
  else
    : >"${backup_dir}/${unit}.absent"
  fi
done
printf '%s\n' "$previous_target" >"${backup_dir}/previous-target"
for timer in "${TIMERS[@]}"; do
  printf '%s enabled=%s active=%s\n' \
    "$timer" "${prior_enabled[$timer]}" "${prior_active[$timer]}" \
    >>"${backup_dir}/prior-timer-state"
done

rollback() {
  local rc=$?
  trap - ERR
  if (( activated )); then
    for timer in "${TIMERS[@]}"; do
      systemctl disable --now "$timer" >/dev/null 2>&1 || true
    done
    if [[ -n "$previous_target" && -d "$previous_target" ]]; then
      ln -sfn "$previous_target" "${INSTALL_ROOT}/current"
    else
      rm -f "${INSTALL_ROOT}/current"
    fi
    for unit in "${UNITS[@]}"; do
      if [[ -f "${backup_dir}/${unit}" ]]; then
        cp -a "${backup_dir}/${unit}" "${UNIT_DIR}/${unit}"
      elif [[ -f "${backup_dir}/${unit}.absent" ]]; then
        rm -f "${UNIT_DIR}/${unit}"
      fi
    done
    systemctl daemon-reload || true
    for timer in "${TIMERS[@]}"; do
      case "${prior_enabled[$timer]}" in
        enabled|enabled-runtime) systemctl enable "$timer" >/dev/null 2>&1 || true ;;
        *) systemctl disable "$timer" >/dev/null 2>&1 || true ;;
      esac
      case "${prior_active[$timer]}" in
        active|activating) systemctl start "$timer" >/dev/null 2>&1 || true ;;
        *) systemctl stop "$timer" >/dev/null 2>&1 || true ;;
      esac
    done
  fi
  echo "deployment failed; restored previous units/current target (rc=${rc})" >&2
  exit "$rc"
}
trap rollback ERR

activated=1
ln -sfn "$release_dir" "${INSTALL_ROOT}/current"
for unit in "${UNITS[@]}"; do
  install -o root -g root -m 0644 "${STAGED_DIR}/${unit}" "${UNIT_DIR}/${unit}"
done
systemctl daemon-reload
systemctl enable --now echo-rah-backup-verify.timer echo-rah-backup-silence.timer
systemctl is-enabled --quiet echo-rah-backup-verify.timer echo-rah-backup-silence.timer
systemctl is-active --quiet echo-rah-backup-verify.timer echo-rah-backup-silence.timer

trap - ERR
echo "deployed ${release_dir}"
echo "rollback snapshot ${backup_dir}"
