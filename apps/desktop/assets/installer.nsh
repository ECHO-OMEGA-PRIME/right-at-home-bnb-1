; RightAtHome BnB Desktop - NSIS Installer Customization
; Maroon #500000 themed installer

!include "MUI2.nsh"

; ============================================================
; Branding
; ============================================================
!define PRODUCT_NAME "RightAtHome BnB"
!define PRODUCT_PUBLISHER "Right At Home Midland"
!define PRODUCT_WEB_SITE "https://rah-midland.com"

; ============================================================
; Installer Attributes
; ============================================================
Name "${PRODUCT_NAME}"
OutFile "RightAtHome-BnB-Setup.exe"
InstallDir "$PROGRAMFILES\RightAtHome BnB"
InstallDirRegKey HKLM "Software\RightAtHomeBnB" "InstallDir"
RequestExecutionLevel admin
ShowInstDetails show
ShowUninstDetails show

; ============================================================
; Modern UI Configuration
; ============================================================
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

; Maroon theme colors
!define MUI_BGCOLOR "500000"
!define MUI_TEXTCOLOR "FFFFFF"

; Welcome page
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT_NAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of ${PRODUCT_NAME}.$\r$\n$\r$\nRightAtHome BnB Desktop gives you powerful property management tools right on your desktop.$\r$\n$\r$\nClick Next to continue."

; Finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\RightAtHome BnB.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${PRODUCT_NAME}"
!define MUI_FINISHPAGE_LINK "Visit ${PRODUCT_WEB_SITE}"
!define MUI_FINISHPAGE_LINK_LOCATION "${PRODUCT_WEB_SITE}"

; ============================================================
; Installer Pages
; ============================================================
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ============================================================
; Languages
; ============================================================
!insertmacro MUI_LANGUAGE "English"

; ============================================================
; Custom Functions
; ============================================================
Function .onInit
    ; Check if already installed
    ReadRegStr $0 HKLM "Software\RightAtHomeBnB" "InstallDir"
    StrCmp $0 "" done

    MessageBox MB_YESNO|MB_ICONQUESTION \
        "${PRODUCT_NAME} is already installed. Do you want to reinstall?" \
        IDYES done
    Abort
done:
FunctionEnd

Function .onInstSuccess
    ; Register application
    WriteRegStr HKLM "Software\RightAtHomeBnB" "InstallDir" "$INSTDIR"
    WriteRegStr HKLM "Software\RightAtHomeBnB" "Version" "${PRODUCT_VERSION}"

    ; Create uninstaller registry entry
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RightAtHomeBnB" \
        "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RightAtHomeBnB" \
        "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RightAtHomeBnB" \
        "DisplayIcon" "$INSTDIR\RightAtHome BnB.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RightAtHomeBnB" \
        "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RightAtHomeBnB" \
        "URLInfoAbout" "${PRODUCT_WEB_SITE}"
FunctionEnd

; ============================================================
; Sections
; ============================================================
Section "Main Application" SecMain
    SectionIn RO ; Read-only, always installed

    SetOutPath "$INSTDIR"

    ; Create start menu shortcuts
    CreateDirectory "$SMPROGRAMS\RightAtHome BnB"
    CreateShortCut "$SMPROGRAMS\RightAtHome BnB\RightAtHome BnB.lnk" "$INSTDIR\RightAtHome BnB.exe"
    CreateShortCut "$SMPROGRAMS\RightAtHome BnB\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

    ; Create desktop shortcut
    CreateShortCut "$DESKTOP\RightAtHome BnB.lnk" "$INSTDIR\RightAtHome BnB.exe"

    ; Write uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Desktop Shortcut" SecDesktop
    CreateShortCut "$DESKTOP\RightAtHome BnB.lnk" "$INSTDIR\RightAtHome BnB.exe"
SectionEnd

Section "Start with Windows" SecAutostart
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
        "RightAtHomeBnB" "$INSTDIR\RightAtHome BnB.exe --hidden"
SectionEnd

; ============================================================
; Uninstaller Section
; ============================================================
Section "Uninstall"
    ; Remove shortcuts
    Delete "$DESKTOP\RightAtHome BnB.lnk"
    RMDir /r "$SMPROGRAMS\RightAtHome BnB"

    ; Remove autostart
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "RightAtHomeBnB"

    ; Remove registry keys
    DeleteRegKey HKLM "Software\RightAtHomeBnB"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\RightAtHomeBnB"

    ; Remove files and directories
    RMDir /r "$INSTDIR"

    ; Remove app data
    RMDir /r "$APPDATA\RightAtHome BnB"
SectionEnd

; ============================================================
; Section Descriptions
; ============================================================
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecMain} "Core application files (required)"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "Create a desktop shortcut"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecAutostart} "Start RightAtHome BnB when Windows starts"
!insertmacro MUI_FUNCTION_DESCRIPTION_END
