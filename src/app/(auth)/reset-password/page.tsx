import { NewPasswordForm } from "../password-forms";

export const metadata = { title: "Choose a new password" };

/** Reached from the password-reset email (the proxy requires a session here). */
export default function ResetPasswordPage() {
  return <NewPasswordForm />;
}
