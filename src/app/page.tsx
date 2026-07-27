/**
 * Login Page — Entry point with email/password authentication.
 * Server Component that renders the LoginForm client component.
 * Allows SSR for SEO and faster initial load.
 */

import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
