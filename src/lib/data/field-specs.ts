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
    { name: "name", label: "Name", type: "text", placeholder: "e.g. Jago", required: true },
    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
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
    { name: "name", label: "Name", type: "text", placeholder: "e.g. Meals", required: true },
    { name: "emoji", label: "Look", type: "identity" },
    {
      name: "group",
      label: "Group",
      type: "segmented",
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
    { name: "name", label: "Name", type: "text", placeholder: "e.g. Travel", required: true },
    { name: "target_amount", label: "Target", type: "money", required: true },
    { name: "target_date", label: "Target date", type: "date", hint: "Optional. Sets the monthly amount you need to save." },
    { name: "starting_amount", label: "Already saved before tracking", type: "money" },
    { name: "archived", label: "Archived", type: "checkbox" },
  ];

  const installments: FieldSpec[] = [
    { name: "name", label: "Name", type: "text", placeholder: "e.g. Cicilan Mobil", required: true },
    { name: "monthly_amount", label: "Per month", type: "money", required: true },
    { name: "tenor_months", label: "Number of months", type: "number", min: 1, max: 120, required: true },
    { name: "start_month", label: "First payment", type: "month", required: true },
    { name: "total_amount", label: "Total", type: "money", hint: "Leave empty to use per month × number of months." },
    { name: "account_id", label: "Paid from or card", type: "select", options: accountOptions, allowEmpty: "None" },
    { name: "category_id", label: "Category", type: "select", options: expenseCategories, allowEmpty: "None" },
    { name: "note", label: "Note", type: "text" },
  ];

  const notTransfer = { field: "type", in: ["expense", "income"] };
  const transfer = { field: "type", in: ["transfer"] };
  const recurring: FieldSpec[] = [
    {
      name: "type",
      label: "Type",
      type: "segmented",
      options: [
        { id: "expense", label: "Expense" },
        { id: "income", label: "Income" },
        { id: "transfer", label: "Transfer" },
      ],
    },
    { name: "amount", label: "Amount", type: "money", required: true },
    { name: "description", label: "Name", type: "text", placeholder: "e.g. Wifi", required: true },
    { name: "category_id", label: "Category", type: "select", options: allCategories, allowEmpty: "None", showWhen: notTransfer, requiredWhen: notTransfer },
    { name: "account_id", label: "Account", type: "select", options: accountOptions, allowEmpty: "Category's account", showWhen: notTransfer },
    { name: "from_category_id", label: "From category", type: "select", options: allCategories, showWhen: transfer, required: true, hint: "Its account is where the money leaves." },
    { name: "category_id", label: "To category", type: "select", options: allCategories, showWhen: transfer, required: true, hint: "Its account is where the money lands." },
    { name: "schedule", label: "Schedule", type: "heading" },
    { name: "frequency", label: "Repeats", type: "schedule" },
    { name: "start_date", label: "Starts", type: "date", required: true },
    { name: "end_date", label: "Ends", type: "date", hint: "Optional. Leave empty to keep it going." },
    { name: "details", label: "Details", type: "heading" },
    { name: "member", label: "Member", type: "select", options: data.members.map((m) => ({ id: m, label: m })), allowEmpty: "Household" },
    {
      name: "installment_id",
      label: "Pays installment",
      type: "select",
      options: data.installments.map((i) => ({ id: i.id, label: i.name })),
      allowEmpty: "None",
      showWhen: { field: "type", in: ["expense"] },
    },
    {
      name: "preview",
      label: "Preview",
      type: "recurring-preview",
      categories: data.categories.map((c) => ({ id: c.id, label: c.name })),
      accounts: data.accounts.map((a) => ({ id: a.id, label: a.name })),
    },
  ];

  return { accounts, categories, goals, installments, recurring };
}
