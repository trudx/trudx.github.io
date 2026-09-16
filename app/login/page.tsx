//* Components Imports
import { AuthShell } from "@/app/_components/auth-shell";

import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      kicker="Bem-vindo de volta"
      title={
        <>
          De volta ao controle <span className="text-background/50">da sua operação.</span>
        </>
      }
      description="Entre para acompanhar clientes, tarefas, agenda e financeiro — tudo sob a mesma ordem."
    >
      <LoginForm />
    </AuthShell>
  );
}
