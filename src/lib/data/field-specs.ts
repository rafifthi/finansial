import type { FieldSpec } from "@/components/app/entity-form";
import type { AppData } from "./app-data";

/** Form layouts per table, built from live option lists. */
export function fieldSpecs(data: AppData) {
  const accountOptions = data.accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, label: a.name }));
  const expenseCategories = data.categories
    .filter((c) => !c.archived && c.kind === "expense")
    .map((c) => ({ id: c.id, label: `${c.name} · ${c.group}` }));
  const allCategories = data.categories.filter((c) => !c.archived).map((c) => ({ id: c.id, label: `${c.name} · ${c.group}` }));

  const accounts: FieldSpec[] = [
    { name: "name", label: "Name", type: "text", placeholder: "Jago", required: true },
    {
      name: "type",
      label: "Type",
      type: "select",
      options: [
        { id: "bank", label: "Bank" },
        { id: "ewallet", label: "E-wallet" },
        { id: "cash", label: "Cash" },
        { id: "credit_card", label: "Credit card" },
        { id: "investment", label: "Investment" },
      ],
    },
    { name: "institution", label: "Bank or app (for its logo)", type: "institution" },
    { name: "opening_balance", label: "Opening balance", type: "money" },
    { name: "archived", label: "Archived (hide from forms)", type: "checkbox" },
  ];

  const categories: FieldSpec[] = [
    { name: "name", label: "Name", type: "text", placeholder: "Meals", required: true },
    { name: "emoji", label: "Look", type: "identity" },
    {
      name: "group",
      label: "Group",
      type: "select",
      options: ["Needs", "Wants", "Savings", "Income"].map((g) => ({ id: g, label: g })),
    },
    { name: "default_account_id", label: "Account (for new transactions)", type: "select", options: accountOptions, allowEmpty: "None" },
    {
      name: "goal_id",
      label: "Funds goal",
      type: "select",
      options: data.goals.filter((g) => !g.archived).map((g) => ({ id: g.id, label: g.name })),
      allowEmpty: "None",
    },
    { name: "archived", label: "Archived (hide from forms)", type: "checkbox" },
  ];

  const goals: FieldSpec[] = [
    { name: "name", label: "Name", type: "text", placeholder: "Travel", required: true },
    { name: "target_amount", label: "Target", type: "money" },
    { name: "target_date", label: "Target date", type: "date" },
    { name: "starting_amount", label: "Already saved before tracking", type: "money" },
    { name: "archived", label: "Archived", type: "checkbox" },
  ];

  const installments: FieldSpec[] = [
    { name: "name", label: "Name", type: "text", placeholder: "Cicilan Mobil", required: true },
    { name: "monthly_amount", label: "Per month", type: "money" },
    { name: "tenor_months", label: "Tenor (months)", type: "number", min: 1, max: 120 },
    { name: "start_month", label: "First instalment month", type: "month" },
    { name: "total_amount", label: "Total (optional, defaults to per month × tenor)", type: "money" },
    { name: "account_id", label: "Paid from / card", type: "select", options: accountOptions, allowEmpty: "None" },
    { name: "category_id", label: "Category", type: "select", options: expenseCategories, allowEmpty: "None", searchable: true },
    { name: "note", label: "Note", type: "text" },
  ];

  const recurring: FieldSpec[] = [
    { name: "description", label: "Description", type: "text", placeholder: "Wifi", required: true },
    {
      name: "type",
      label: "Type",
      type: "select",
      options: [
        { id: "expense", label: "Expense" },
        { id: "income", label: "Income" },
        { id: "transfer", label: "Transfer" },
      ],
    },
    { name: "amount", label: "Amount", type: "money" },
    { name: "category_id", label: "Category", type: "select", options: allCategories, allowEmpty: "None", searchable: true },
    { name: "account_id", label: "Account", type: "select", options: accountOptions, allowEmpty: "Category default" },
    { name: "to_account_id", label: "To account (transfers)", type: "select", options: accountOptions, allowEmpty: "None" },
    {
      name: "frequency",
      label: "Repeats",
      type: "select",
      options: [
        { id: "monthly", label: "Monthly" },
        { id: "weekly", label: "Weekly" },
      ],
    },
    { name: "day", label: "Day", type: "number", min: 0, max: 31, hint: "Monthly: day of month (31 = last day). Weekly: 0 = Sun … 6 = Sat." },
    { name: "start_date", label: "Starts", type: "date" },
    { name: "end_date", label: "Ends (optional)", type: "date" },
    { name: "member", label: "Member", type: "select", options: data.members.map((m) => ({ id: m, label: m })), allowEmpty: "Household" },
    {
      name: "installment_id",
      label: "Pays installment",
      type: "select",
      options: data.installments.map((i) => ({ id: i.id, label: i.name })),
      allowEmpty: "None",
    },
  ];

  return { accounts, categories, goals, installments, recurring };
}
