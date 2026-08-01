from __future__ import annotations

from pathlib import Path

ROOT = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\mobile")


def replace(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"{label}: expected text not found in {path}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
    print(f"PATCHED={path} :: {label}")


# App navigation: use navigator-compatible adapters and actual saved auth state.
app = ROOT / "App.tsx"
replace(
    app,
    "import { createNativeStackNavigator } from '@react-navigation/native-stack';",
    "import { createNativeStackNavigator } from '@react-navigation/native-stack';\nimport type { NativeStackScreenProps } from '@react-navigation/native-stack';",
    "import NativeStackScreenProps",
)
replace(
    app,
    "import { SyncProvider } from './src/context/SyncContext';",
    "import { SyncProvider } from './src/context/SyncContext';\nimport { getSavedAuthUser, type AuthUser } from './src/services/auth';",
    "import saved mobile auth",
)
replace(
    app,
    "const queryClient = new QueryClient();",
    """const queryClient = new QueryClient();

type GPSCheckInRouteProps = NativeStackScreenProps<RootStackParamList, 'GPSCheckIn'>;
type PhotoCaptureRouteProps = NativeStackScreenProps<RootStackParamList, 'PhotoCapture'>;
type ChecklistRouteProps = NativeStackScreenProps<RootStackParamList, 'Checklist'>;

const GPSCheckInRoute = (props: GPSCheckInRouteProps) => (
  <GPSCheckInScreen {...(props as any)} />
);
const PhotoCaptureRoute = (props: PhotoCaptureRouteProps) => (
  <PhotoCaptureScreen {...(props as any)} />
);
const ChecklistRoute = (props: ChecklistRouteProps) => (
  <ChecklistScreen {...(props as any)} />
);""",
    "add stack route adapters",
)
replace(
    app,
    """      const token = await AsyncStorage.getItem('@rightathome_auth_token');
      const role = await AsyncStorage.getItem('@rightathome_user_role') as UserRole | null;
      setIsAuthenticated(!!token);
      setUserRole(role);""",
    """      const savedUser = await getSavedAuthUser();
      const role = await AsyncStorage.getItem('@rightathome_user_role') as UserRole | null;
      setIsAuthenticated(Boolean(savedUser));
      setUserRole(role);""",
    "use saved Firebase auth state",
)
replace(
    app,
    """  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return (""",
    """  const handleLoginSuccess = async (_user: AuthUser) => {
    const role = await AsyncStorage.getItem('@rightathome_user_role') as UserRole | null;
    setIsAuthenticated(true);
    setUserRole(role);
  };

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return (""",
    "add login success handler",
)
replace(
    app,
    """      {!isAuthenticated ? (
        <Stack.Screen name=\"Login\" component={LoginScreen} />
      ) : null}""",
    """      {!isAuthenticated ? (
        <Stack.Screen name=\"Login\">
          {({ navigation }) => (
            <LoginScreen
              navigation={navigation}
              onLoginSuccess={handleLoginSuccess}
            />
          )}
        </Stack.Screen>
      ) : null}""",
    "render login with callback",
)
replace(app, "component={GPSCheckInScreen}", "component={GPSCheckInRoute}", "adapt GPS screen")
replace(app, "component={PhotoCaptureScreen}", "component={PhotoCaptureRoute}", "adapt photo screen")
replace(app, "component={ChecklistScreen}", "component={ChecklistRoute}", "adapt checklist screen")

# Issue report: separate identifier and option types, and use configured API.
issue = ROOT / "src" / "screens" / "IssueReportScreen.tsx"
replace(
    issue,
    """type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';
type IssueCategory = 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'structural' | 'cleaning' | 'safety' | 'other';

interface IssueCategory {
  id: IssueCategory;
  label: string;
  icon: string;
}

const ISSUE_CATEGORIES: IssueCategory[] = [""",
    """type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';
type IssueCategoryId =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'appliance'
  | 'structural'
  | 'cleaning'
  | 'safety'
  | 'other';

interface IssueCategoryOption {
  id: IssueCategoryId;
  label: string;
  icon: string;
}

const ISSUE_CATEGORIES: IssueCategoryOption[] = [""",
    "separate issue category types",
)
replace(
    issue,
    "const [category, setCategory] = useState<string | null>(null);",
    "const [category, setCategory] = useState<IssueCategoryId | null>(null);",
    "type issue category state",
)
replace(
    issue,
    """      // Submit to API
      const response = await fetch('https://api.rightathome.bnb/issues/report', {""",
    """      // Submit to the configured API authority.
      const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\\/+$/, '');
      if (!apiBase) throw new Error('EXPO_PUBLIC_API_URL is not configured');

      const response = await fetch(`${apiBase}/issues/report`, {""",
    "use configured issue API",
)

# Booking mock status must be a union, not the single checked_in literal.
booking = ROOT / "src" / "screens" / "owner" / "BookingDetailScreen.tsx"
replace(
    booking,
    "// Mock data\nconst MOCK_BOOKING = {",
    """type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
type BookingSource = 'direct' | 'airbnb' | 'vrbo' | 'booking.com';

// Mock data
const MOCK_BOOKING = {""",
    "define booking unions",
)
replace(booking, "status: 'checked_in' as const,", "status: 'checked_in' as BookingStatus,", "widen booking status")
replace(booking, "source: 'airbnb' as const,", "source: 'airbnb' as BookingSource,", "widen booking source")

# Expo 50 exposes CameraView through its bundled next API.
photo_screen = ROOT / "src" / "screens" / "PhotoCaptureScreen.tsx"
replace(
    photo_screen,
    "import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';",
    "import { CameraView, CameraType, useCameraPermissions } from 'expo-camera/next';",
    "use Expo 50 camera next API",
)

# Normalize nullable image-picker metadata and use configured API.
camera = ROOT / "src" / "services" / "camera.ts"
replace(camera, "base64: asset.base64,\n      exif: asset.exif,", "base64: asset.base64 ?? undefined,\n      exif: asset.exif ?? undefined,", "normalize camera metadata")
replace(camera, "base64: asset.base64,\n      exif: asset.exif ?? undefined,", "base64: asset.base64 ?? undefined,\n      exif: asset.exif ?? undefined,", "normalize gallery metadata")
replace(
    camera,
    """    // Upload to API
    const response = await fetch('https://api.rightathome.bnb/photos/upload', {""",
    """    // Upload to the configured API authority.
    const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\\/+$/, '');
    if (!apiBase) throw new Error('EXPO_PUBLIC_API_URL is not configured');

    const response = await fetch(`${apiBase}/photos/upload`, {""",
    "use configured photo API",
)

# Remove literal-value coupling between light and dark color objects.
colors = ROOT / "src" / "theme" / "colors.ts"
replace(
    colors,
    "export type ColorTheme = typeof COLORS;",
    "export type ColorTheme = { [Key in keyof typeof COLORS]: string };",
    "widen color theme values",
)

# Explicit callback typing in profile initials generation.
profile = ROOT / "src" / "screens" / "ProfileScreen.tsx"
replace(
    profile,
    ".split(' ').map((n) => n[0]).join('').toUpperCase()",
    ".split(' ').map((n: string) => n[0]).join('').toUpperCase()",
    "type profile initials callback",
)

print("MOBILE_CODE_PATCHES_COMPLETE")
