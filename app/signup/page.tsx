//* Components Imports
import { AuthShell } from "@/app/_components/auth-shell";

import { SignupForm } from "./_components/signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      kicker="Comece grátis"
      title={
        <>
          Sua operação freelance <span className="text-background/50">em um só lugar.</span>
        </>
      }
      description="Clientes, tarefas, agenda e financeiro numa única plataforma, feita para quem toca o negócio sozinho."
    >
      <SignupForm />
    </AuthShell>
  );
}
