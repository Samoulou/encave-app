/**
 * Skip-link target: the unsubscribe states render no <main> of their own.
 */
export default function UnsubscribeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main id="main-content">{children}</main>;
}
