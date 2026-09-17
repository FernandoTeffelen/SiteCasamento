import { AccountFormFeedback } from "@/features/account/account-form-feedback";

export default function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AccountFormFeedback />
      {children}
    </>
  );
}
