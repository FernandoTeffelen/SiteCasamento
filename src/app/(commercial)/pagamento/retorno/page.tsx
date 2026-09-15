import Link from "next/link";
import { PaymentAttemptStatus } from "@/generated/prisma/client";
import { getAdminDashboardAccess, getCurrentAdminSession } from "@/server/auth/admin-auth.service";
import { prisma } from "@/server/db/prisma";
import { PaymentStatusRefresh } from "./payment-status-refresh";

export const metadata = { title: "Status do pagamento | SiteCasamento" };

const statusCopy: Record<PaymentAttemptStatus, { title: string; message: string; tone: string }> = {
  CREATED: { title: "Preparando confirmação", message: "A compra foi registrada e aguarda atualização do Mercado Pago.", tone: "pending" },
  PENDING: { title: "Pagamento em processamento", message: "PIX e algumas análises podem levar alguns instantes. Atualize esta página depois.", tone: "pending" },
  APPROVED: { title: "Pagamento confirmado", message: "O Mercado Pago confirmou a compra e o produto já foi liberado na sua conta.", tone: "success" },
  REJECTED: { title: "Pagamento não aprovado", message: "O pagamento não foi aprovado. Você pode voltar aos planos e tentar novamente.", tone: "error" },
  CANCELED: { title: "Pagamento cancelado", message: "Nenhuma liberação foi realizada. Você pode iniciar uma nova compra quando quiser.", tone: "error" },
  REFUNDED: { title: "Pagamento devolvido", message: "A devolução foi registrada. O ajuste de acesso será revisado pelo atendimento.", tone: "pending" },
  ERROR: { title: "Confirmação em análise", message: "Encontramos uma divergência e não liberamos o produto automaticamente. Entre em contato com o atendimento.", tone: "error" },
};

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ external_reference?: string }>;
}) {
  const [params, user] = await Promise.all([searchParams, getCurrentAdminSession()]);
  const externalReference = params.external_reference?.slice(0, 200);
  const attempt = user && externalReference
    ? await prisma.paymentAttempt.findFirst({
      where: { externalReference, userId: user.id },
      select: { status: true, credits: true, priceCents: true, currency: true, updatedAt: true },
    })
    : null;
  const access = user ? await getAdminDashboardAccess(user.id) : null;
  const copy = attempt
    ? statusCopy[attempt.status]
    : { title: "Consulte sua compra", message: "O retorno do navegador não confirma um pagamento. Entre na sua conta para consultar o status registrado pelo servidor.", tone: "pending" };

  return (
    <main className="payment-return-layout">
      <section className={`payment-return-card ${copy.tone}`}>
        <span className="section-tag">MERCADO PAGO</span>
        <h1>{copy.title}</h1>
        <p>{copy.message}</p>
        {attempt ? (
          <dl className="payment-return-details">
            <div><dt>Créditos do produto</dt><dd>{attempt.credits}</dd></div>
            <div><dt>Valor</dt><dd>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: attempt.currency }).format(attempt.priceCents / 100)}</dd></div>
            <div><dt>Última atualização</dt><dd>{attempt.updatedAt.toLocaleString("pt-BR")}</dd></div>
          </dl>
        ) : null}
        <div className="payment-return-actions">
          {user ? (
            <Link href={access?.canAccessDashboard ? "/app" : "/planos"} className="btn-plan-continue">
              {access?.canAccessDashboard ? "Ir para o painel" : "Voltar aos planos"}
            </Link>
          ) : <Link href="/app/login" className="btn-plan-continue">Entrar na conta</Link>}
          {attempt && (attempt.status === PaymentAttemptStatus.CREATED || attempt.status === PaymentAttemptStatus.PENDING) ? <PaymentStatusRefresh /> : null}
          <Link href="/planos" className="btn-plan-back">Ver planos e créditos</Link>
        </div>
        <small>A liberação depende da notificação autenticada do Mercado Pago, nunca apenas desta página.</small>
      </section>
    </main>
  );
}
