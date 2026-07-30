import PropertiesRouteGuard from '@/components/properties/PropertiesRouteGuard';

export default function PropertiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PropertiesRouteGuard>{children}</PropertiesRouteGuard>;
}
