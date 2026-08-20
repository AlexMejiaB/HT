import type { Metadata } from "next";
import { FormularioEntrar } from "@/app/entrar/formulario";
import { Logotipo } from "@/components/marca";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { siguiente } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-papel px-5">
      <div className="w-full max-w-sm">
        <Logotipo />
        <h1 className="titular mt-8 text-3xl">Entra al panel</h1>
        <p className="mt-2 text-sm text-apagado">
          Revisa conversaciones, leads y casos escalados de tu tienda.
        </p>
        <FormularioEntrar siguiente={typeof siguiente === "string" ? siguiente : undefined} />
      </div>
    </main>
  );
}
