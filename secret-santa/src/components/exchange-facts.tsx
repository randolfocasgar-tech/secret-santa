import { CalendarIcon, UsersIcon, WalletIcon } from "@/components/icons";
import { formatGiftDate, formatMoney } from "@/lib/format";

export function ExchangeFacts({
  giftDate,
  budget,
  currency,
  participantCount,
  countdown,
}: {
  giftDate: string;
  budget: number;
  currency: string;
  participantCount?: number;
  countdown?: string;
}) {
  const items = [
    {
      icon: CalendarIcon,
      label: "Entrega de regalos",
      value: formatGiftDate(giftDate),
      extra: countdown,
    },
    { icon: WalletIcon, label: "Presupuesto", value: formatMoney(budget, currency), extra: "por regalo" },
  ];
  if (participantCount !== undefined) {
    items.push({
      icon: UsersIcon,
      label: "Participantes",
      value: participantCount === 1 ? "1 persona" : `${participantCount} personas`,
      extra: undefined,
    });
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
            <item.icon className="size-5" />
          </span>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{item.label}</dt>
            <dd className="mt-0.5 font-semibold text-pine-900 first-letter:uppercase">{item.value}</dd>
            {item.extra ? <dd className="text-xs text-muted">{item.extra}</dd> : null}
          </div>
        </div>
      ))}
    </dl>
  );
}
