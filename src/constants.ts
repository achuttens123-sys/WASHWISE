export const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL || "ashwinchuttipara@gmail.com";

export const isSuperAdminEmail = (email: string | null | undefined) => {
  if (!email) return false;
  return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
};
