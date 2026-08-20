import { Hero } from "@/components/hero";
import { Mensaje } from "@/components/mensaje";
import { Paquetes } from "@/components/paquetes";
import { Demo } from "@/components/demo";
import { Guardrails } from "@/components/guardrails";
import { Proceso } from "@/components/proceso";
import { Cierre, Pie } from "@/components/cierre";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <Mensaje />
        <Paquetes />
        <Demo />
        <Guardrails />
        <Proceso />
        <Cierre />
      </main>
      <Pie />
    </>
  );
}
