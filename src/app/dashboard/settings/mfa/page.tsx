import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { MfaEnrollment } from "./MfaEnrollment";

export default async function MfaSettingsPage() {
  const user = await requireUser();
  const record = await prisma.organiserUser.findUniqueOrThrow({
    where: { id: user.id },
    select: { mfaEnrolled: true, role: true, email: true, name: true }
  });

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Two-factor authentication</h1>
        <p className="text-sm text-slate-600">
          {record.mfaEnrolled
            ? "MFA is enabled on your organiser account."
            : "Add an authenticator app for an extra layer of security."}
          {(record.role === "ADMIN" || record.role === "SUPER_ADMIN") && !record.mfaEnrolled && (
            <span className="ml-1 font-semibold text-amber-700">
              Strongly recommended for {record.role}.
            </span>
          )}
        </p>
      </header>

      <MfaEnrollment enrolled={record.mfaEnrolled} accountEmail={record.email} />
    </div>
  );
}
