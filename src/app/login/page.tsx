import { Nav } from "@/components/nav";
import { AuthForm } from "@/components/auth-form";
export default function Page() {
  return (
    <>
      <Nav />
      <AuthForm mode="login" />
    </>
  );
}
