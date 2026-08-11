"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateTicketSales(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const showId = String(formData.get("show_id") ?? "");
  const facilityFeePerTicket = Number(formData.get("facility_fee_per_ticket") ?? 2);
  const packageExpenses = Number(formData.get("package_expenses") ?? 250);
  const dealBasePercent = Number(formData.get("deal_base_percent") ?? 50);
  const dealTier1Threshold = Number(formData.get("deal_tier_1_threshold") ?? 50);
  const dealTier1Percent = Number(formData.get("deal_tier_1_percent") ?? 60);
  const dealTier2Threshold = Number(formData.get("deal_tier_2_threshold") ?? 100);
  const dealTier2Percent = Number(formData.get("deal_tier_2_percent") ?? 70);

  if (!showId) {
    throw new Error("Show ID is missing.");
  }

  const dealValues = [
    facilityFeePerTicket,
    packageExpenses,
    dealBasePercent,
    dealTier1Threshold,
    dealTier1Percent,
    dealTier2Threshold,
    dealTier2Percent,
  ];

  if (
    dealValues.some((value) => !Number.isFinite(value) || value < 0) ||
    !Number.isInteger(dealTier1Threshold) ||
    !Number.isInteger(dealTier2Threshold) ||
    dealTier2Threshold < dealTier1Threshold ||
    dealBasePercent > 100 ||
    dealTier1Percent > 100 ||
    dealTier2Percent > 100
  ) {
    redirect(`/admin/shows/${showId}?error=${encodeURIComponent(
      "Deal terms must be valid. Tier 2 must be at or above Tier 1, and percentages cannot exceed 100."
    )}`);
  }

  const { error: dealError } = await supabase
    .from("shows")
    .update({
      facility_fee_per_ticket: facilityFeePerTicket,
      package_expenses: packageExpenses,
      deal_base_percent: dealBasePercent,
      deal_tier_1_threshold: dealTier1Threshold,
      deal_tier_1_percent: dealTier1Percent,
      deal_tier_2_threshold: dealTier2Threshold,
      deal_tier_2_percent: dealTier2Percent,
    })
    .eq("id", showId);

  if (dealError) {
    redirect(`/admin/shows/${showId}?error=${encodeURIComponent(dealError.message)}`);
  }

  const ticketIds = formData.getAll("ticket_id").map(String);

  for (const ticketId of ticketIds) {
    const ticketType = String(
      formData.get(`ticket_type_${ticketId}`) ?? ""
    ).trim();

    const channel = String(
      formData.get(`ticket_channel_${ticketId}`) ?? ""
    ).trim();

    const allowedChannels = ["online", "offline", "door", "reserved"];

    const venmoServiceFee =
      formData.get(`venmo_service_fee_${ticketId}`) === "on";

    const price = Number(
      formData.get(`ticket_price_${ticketId}`) ?? 0
    );

    const projectedQuantity = Number(
      formData.get(`projected_quantity_${ticketId}`) ?? 0
    );

    const actualQuantity = Number(
      formData.get(`actual_quantity_${ticketId}`) ?? 0
    );

    if (
      !ticketType ||
      !allowedChannels.includes(channel) ||
      !Number.isFinite(price) ||
      !Number.isInteger(projectedQuantity) ||
      !Number.isInteger(actualQuantity) ||
      price < 0 ||
      projectedQuantity < 0 ||
      actualQuantity < 0
    ) {
      redirect(
        `/admin/shows/${showId}?error=${encodeURIComponent(
          "Ticket type, channel, prices, and quantities must be valid."
        )}`
      );
    }

    const { error } = await supabase
      .from("ticket_sales")
      .update({
        ticket_type: ticketType,
        channel,
        ticket_price: price,
        projected_quantity: projectedQuantity,
        actual_quantity: actualQuantity,
        venmo_service_fee: venmoServiceFee,
      })
      .eq("id", ticketId)
      .eq("show_id", showId);

    if (error) {
      redirect(
        `/admin/shows/${showId}?error=${encodeURIComponent(
          error.message
        )}`
      );
    }
  }

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);

  redirect(`/admin/shows/${showId}?saved=tickets`);
}

export async function addTicketType(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const showId = String(formData.get("show_id") ?? "");
  const ticketType = String(formData.get("ticket_type") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const allowedChannels = ["online", "offline", "door", "reserved"];
  const ticketPrice = Number(formData.get("ticket_price") ?? 0);
  const projectedQuantity = Number(formData.get("projected_quantity") ?? 0);
  const venmoServiceFee = formData.get("venmo_service_fee") === "on";

  if (
    !showId ||
    !ticketType ||
    !allowedChannels.includes(channel) ||
    !Number.isFinite(ticketPrice) ||
    ticketPrice < 0 ||
    !Number.isInteger(projectedQuantity) ||
    projectedQuantity < 0
  ) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "Enter a ticket type, choose a valid channel, and enter a valid price and projected quantity."
      )}`
    );
  }

  const { error } = await supabase.from("ticket_sales").insert({
    show_id: showId,
    ticket_type: ticketType,
    channel,
    ticket_price: ticketPrice,
    projected_quantity: projectedQuantity,
    actual_quantity: 0,
    venmo_service_fee: venmoServiceFee,
  });

  if (error) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);
  revalidatePath("/shows");

  redirect(`/admin/shows/${showId}?saved=ticket-type-added`);
}

export async function deleteTicketType(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const showId = String(formData.get("show_id") ?? "");
  const ticketId = String(formData.get("ticket_id") ?? "");

  if (!showId || !ticketId) {
    throw new Error("Show ID or ticket ID is missing.");
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("ticket_sales")
    .select("actual_quantity")
    .eq("id", ticketId)
    .eq("show_id", showId)
    .maybeSingle();

  if (ticketError) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(ticketError.message)}`
    );
  }

  if (!ticket) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent("Ticket type not found.")}`
    );
  }

  if (Number(ticket.actual_quantity ?? 0) > 0) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "This ticket type has recorded sales. Set Actual Sold to 0 before deleting it, or keep it for transaction history."
      )}`
    );
  }

  const { count, error: orderError } = await supabase
    .from("venmo_order_items")
    .select("id", { count: "exact", head: true })
    .eq("ticket_sale_id", ticketId);

  if (orderError) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(orderError.message)}`
    );
  }

  if ((count ?? 0) > 0) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "This ticket type is linked to a Venmo order and cannot be deleted without losing order history. Rename it instead."
      )}`
    );
  }

  const { error } = await supabase
    .from("ticket_sales")
    .delete()
    .eq("id", ticketId)
    .eq("show_id", showId);

  if (error) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);
  revalidatePath("/shows");

  redirect(`/admin/shows/${showId}?saved=ticket-type-deleted`);
}

export async function addExpense(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const showId = String(formData.get("show_id") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const description = String(
    formData.get("description") ?? ""
  ).trim();

  const budgetAmount = Number(
    formData.get("budget_amount") ?? 0
  );

  const actualAmount = Number(
    formData.get("actual_amount") ?? 0
  );

  const paidBy = String(formData.get("paid_by") ?? "").trim();
  const paymentMethod = String(
    formData.get("payment_method") ?? ""
  ).trim();

  const reimbursed =
    formData.get("reimbursed") === "on";

  const notes = String(formData.get("notes") ?? "").trim();

  if (!showId || !category) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "Expense category is required."
      )}`
    );
  }

  if (
    !Number.isFinite(budgetAmount) ||
    !Number.isFinite(actualAmount) ||
    budgetAmount < 0 ||
    actualAmount < 0
  ) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "Expense amounts must be valid nonnegative numbers."
      )}`
    );
  }

  const { error } = await supabase.from("expenses").insert({
    show_id: showId,
    category,
    description: description || null,
    budget_amount: budgetAmount,
    actual_amount: actualAmount,
    paid_by: paidBy || null,
    payment_method: paymentMethod || null,
    reimbursed,
    reimbursed_at: reimbursed
      ? new Date().toISOString()
      : null,
    notes: notes || null,
  });

  if (error) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);

  redirect(`/admin/shows/${showId}?saved=expense`);
}

export async function deleteExpense(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const showId = String(formData.get("show_id") ?? "");
  const expenseId = String(formData.get("expense_id") ?? "");

  if (!showId || !expenseId) {
    throw new Error("Show ID or expense ID is missing.");
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("show_id", showId);

  if (error) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);

  redirect(`/admin/shows/${showId}?saved=expense-deleted`);
}

export async function addMerchSale(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const showId = String(formData.get("show_id") ?? "");
  const itemName = String(formData.get("item_name") ?? "").trim();
  const size = String(formData.get("size") ?? "").trim();
  const quantitySold = Number(formData.get("quantity_sold") ?? 0);
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  const unitCost = Number(formData.get("unit_cost") ?? 0);
  const paymentMethod = String(
    formData.get("payment_method") ?? "cash"
  );

  if (!showId || !itemName) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "Merchandise item name is required."
      )}`
    );
  }

  if (
    !Number.isInteger(quantitySold) ||
    quantitySold < 0 ||
    !Number.isFinite(unitPrice) ||
    unitPrice < 0 ||
    !Number.isFinite(unitCost) ||
    unitCost < 0
  ) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "Merchandise values must be valid nonnegative numbers."
      )}`
    );
  }

  const { error } = await supabase.from("merch_sales").insert({
    show_id: showId,
    item_name: itemName,
    size: size || null,
    quantity_sold: quantitySold,
    unit_price: unitPrice,
    unit_cost: unitCost,
    payment_method: paymentMethod,
  });

  if (error) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);

  redirect(`/admin/shows/${showId}?saved=merch`);
}

export async function deleteMerchSale(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const showId = String(formData.get("show_id") ?? "");
  const merchId = String(formData.get("merch_id") ?? "");

  if (!showId || !merchId) {
    throw new Error("Show ID or merchandise ID is missing.");
  }

  const { error } = await supabase
    .from("merch_sales")
    .delete()
    .eq("id", merchId)
    .eq("show_id", showId);

  if (error) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);

  redirect(`/admin/shows/${showId}?saved=merch-deleted`);
}
export async function updateShowSettlement(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const showId = String(formData.get("show_id") ?? "");
  const status = String(formData.get("status") ?? "upcoming");
  const otherIncome = Number(formData.get("other_income") ?? 0);

  const validStatuses = [
    "draft",
    "upcoming",
    "completed",
    "cancelled",
  ];

  if (!showId) {
    throw new Error("Show ID is missing.");
  }

  if (!validStatuses.includes(status)) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "Invalid show status."
      )}`
    );
  }

  if (!Number.isFinite(otherIncome) || otherIncome < 0) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "Other income must be a valid nonnegative number."
      )}`
    );
  }

  const { error } = await supabase
    .from("shows")
    .update({
      status,
      other_income: otherIncome,
    })
    .eq("id", showId);

  if (error) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);

  redirect(`/admin/shows/${showId}?saved=settlement`);
}
export async function updateShowDetails(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const showId = String(formData.get("show_id") ?? "");
  const venueName = String(formData.get("venue_name") ?? "").trim();
  const showName = String(formData.get("show_name") ?? "").trim();
  const showDate = String(formData.get("show_date") ?? "");

  const capacity = Number(formData.get("capacity") ?? 300);
  const ticketGoal = Number(formData.get("ticket_goal") ?? 50);
  const numberOfActs = Number(formData.get("number_of_acts") ?? 3);

  const doorsTime = String(formData.get("doors_time") ?? "19:00");
  const startTime = String(formData.get("start_time") ?? "20:00");
  const endTime = String(formData.get("end_time") ?? "00:00");

  const radiusClauseWeeks = Number(
    formData.get("radius_clause_weeks") ?? 4
  );

  const radiusClauseMiles = Number(
    formData.get("radius_clause_miles") ?? 20
  );

  const foodDiscountPercent = Number(
    formData.get("food_discount_percent") ?? 40
  );

  const mealsThreshold = Number(
    formData.get("meals_included_ticket_threshold") ?? 50
  );

  const notes = String(formData.get("notes") ?? "").trim();

  if (!showId || !venueName || !showDate) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "Venue and show date are required."
      )}`
    );
  }

  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    !Number.isInteger(ticketGoal) ||
    ticketGoal < 0 ||
    !Number.isInteger(numberOfActs) ||
    numberOfActs < 1 ||
    !Number.isInteger(radiusClauseWeeks) ||
    radiusClauseWeeks < 0 ||
    !Number.isInteger(radiusClauseMiles) ||
    radiusClauseMiles < 0 ||
    !Number.isFinite(foodDiscountPercent) ||
    foodDiscountPercent < 0 ||
    foodDiscountPercent > 100 ||
    !Number.isInteger(mealsThreshold) ||
    mealsThreshold < 0
  ) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "One or more show values are invalid."
      )}`
    );
  }

  const { data: existingVenue, error: venueLookupError } = await supabase
    .from("venues")
    .select("id")
    .ilike("name", venueName)
    .limit(1)
    .maybeSingle();

  if (venueLookupError) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        venueLookupError.message
      )}`
    );
  }

  let venueId = existingVenue?.id;

  if (!venueId) {
    const { data: newVenue, error: venueInsertError } = await supabase
      .from("venues")
      .insert({
        name: venueName,
        default_capacity: capacity,
      })
      .select("id")
      .single();

    if (venueInsertError) {
      redirect(
        `/admin/shows/${showId}?error=${encodeURIComponent(
          venueInsertError.message
        )}`
      );
    }

    venueId = newVenue.id;
  }

  const { error } = await supabase
    .from("shows")
    .update({
      show_name: showName || `${venueName} Show`,
      venue_id: venueId,
      show_date: showDate,
      capacity,
      ticket_goal: ticketGoal,
      number_of_acts: numberOfActs,
      doors_time: doorsTime || null,
      start_time: startTime || null,
      end_time: endTime || null,
      radius_clause_weeks: radiusClauseWeeks,
      radius_clause_miles: radiusClauseMiles,
      food_discount_percent: foodDiscountPercent,
      meals_included_ticket_threshold: mealsThreshold,
      notes: notes || null,
    })
    .eq("id", showId);

  if (error) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);

  redirect(`/admin/shows/${showId}?saved=show-details`);
}

export async function updateExpense(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const showId = String(formData.get("show_id") ?? "");
  const expenseId = String(formData.get("expense_id") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const budgetAmount = Number(formData.get("budget_amount") ?? 0);
  const actualAmount = Number(formData.get("actual_amount") ?? 0);
  const paidBy = String(formData.get("paid_by") ?? "").trim();
  const paymentMethod = String(formData.get("payment_method") ?? "").trim();
  const reimbursed = formData.get("reimbursed") === "on";
  const notes = String(formData.get("notes") ?? "").trim();

  if (!showId || !expenseId || !category) {
    redirect(`/admin/shows/${showId}?error=${encodeURIComponent("Expense ID, category, and show ID are required.")}`);
  }

  if (!Number.isFinite(budgetAmount) || !Number.isFinite(actualAmount) || budgetAmount < 0 || actualAmount < 0) {
    redirect(`/admin/shows/${showId}?error=${encodeURIComponent("Expense amounts must be valid nonnegative numbers.")}`);
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      category,
      description: description || null,
      budget_amount: budgetAmount,
      actual_amount: actualAmount,
      paid_by: paidBy || null,
      payment_method: paymentMethod || null,
      reimbursed,
      reimbursed_at: reimbursed ? new Date().toISOString() : null,
      notes: notes || null,
    })
    .eq("id", expenseId)
    .eq("show_id", showId);

  if (error) redirect(`/admin/shows/${showId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);
  redirect(`/admin/shows/${showId}?saved=expense-updated`);
}

export async function toggleExpenseReimbursed(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const showId = String(formData.get("show_id") ?? "");
  const expenseId = String(formData.get("expense_id") ?? "");
  const reimbursed = formData.get("reimbursed") === "true";

  const { error } = await supabase
    .from("expenses")
    .update({
      reimbursed,
      reimbursed_at: reimbursed ? new Date().toISOString() : null,
    })
    .eq("id", expenseId)
    .eq("show_id", showId);

  if (error) redirect(`/admin/shows/${showId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);
  redirect(`/admin/shows/${showId}?saved=reimbursement`);
}

export async function updateMerchSale(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const showId = String(formData.get("show_id") ?? "");
  const merchId = String(formData.get("merch_id") ?? "");
  const itemName = String(formData.get("item_name") ?? "").trim();
  const size = String(formData.get("size") ?? "").trim();
  const quantitySold = Number(formData.get("quantity_sold") ?? 0);
  const unitPrice = Number(formData.get("unit_price") ?? 0);
  const unitCost = Number(formData.get("unit_cost") ?? 0);
  const paymentMethod = String(formData.get("payment_method") ?? "cash");

  if (!showId || !merchId || !itemName) {
    redirect(`/admin/shows/${showId}?error=${encodeURIComponent("Merchandise ID, item name, and show ID are required.")}`);
  }

  if (!Number.isInteger(quantitySold) || quantitySold < 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(unitCost) || unitCost < 0) {
    redirect(`/admin/shows/${showId}?error=${encodeURIComponent("Merchandise values must be valid nonnegative numbers.")}`);
  }

  const { error } = await supabase
    .from("merch_sales")
    .update({
      item_name: itemName,
      size: size || null,
      quantity_sold: quantitySold,
      unit_price: unitPrice,
      unit_cost: unitCost,
      payment_method: paymentMethod,
    })
    .eq("id", merchId)
    .eq("show_id", showId);

  if (error) redirect(`/admin/shows/${showId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);
  redirect(`/admin/shows/${showId}?saved=merch-updated`);
}

export async function duplicateShow(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const showId = String(formData.get("show_id") ?? "");
  const { data: source, error: sourceError } = await supabase
    .from("shows")
    .select("*")
    .eq("id", showId)
    .single();

  if (sourceError || !source) {
    redirect(`/admin/shows/${showId}?error=${encodeURIComponent(sourceError?.message ?? "Show not found.")}`);
  }

  const { data: newShow, error: insertError } = await supabase
    .from("shows")
    .insert({
      venue_id: source.venue_id,
      show_name: `${source.show_name ?? "Show"} Copy`,
      show_date: source.show_date,
      doors_time: source.doors_time,
      start_time: source.start_time,
      end_time: source.end_time,
      capacity: source.capacity,
      ticket_goal: source.ticket_goal,
      number_of_acts: source.number_of_acts,
      status: "draft",
      radius_clause_weeks: source.radius_clause_weeks,
      radius_clause_miles: source.radius_clause_miles,
      meals_included_ticket_threshold: source.meals_included_ticket_threshold,
      food_discount_percent: source.food_discount_percent,
      drinks_included: source.drinks_included,
      pa_provided: source.pa_provided,
      sound_engineer_provided: source.sound_engineer_provided,
      box_office_provided: source.box_office_provided,
      notes: source.notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !newShow) {
    redirect(`/admin/shows/${showId}?error=${encodeURIComponent(insertError?.message ?? "Could not duplicate show.")}`);
  }

  const { data: tickets } = await supabase
    .from("ticket_sales")
    .select("ticket_type, channel, ticket_price, projected_quantity")
    .eq("show_id", showId);

  if (tickets?.length) {
    await supabase.from("ticket_sales").insert(
      tickets.map((ticket) => ({
        ...ticket,
        show_id: newShow.id,
        actual_quantity: 0,
      }))
    );
  }

  revalidatePath("/admin/shows");
  redirect(`/admin/shows/${newShow.id}?saved=duplicated`);
}

export async function addShowPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const showId = String(formData.get("show_id") ?? "");
  const memberName = String(formData.get("member_name") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const paid = formData.get("paid") === "on";

  if (!showId || !memberName || !Number.isFinite(amount) || amount < 0) {
    redirect(`/admin/shows/${showId}?error=${encodeURIComponent("Band member and a valid payment amount are required.")}`);
  }

  const { error } = await supabase.from("show_payments").insert({
    show_id: showId,
    member_name: memberName,
    amount,
    paid,
    paid_at: paid ? new Date().toISOString() : null,
  });

  if (error) redirect(`/admin/shows/${showId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/admin/shows/${showId}`);
  redirect(`/admin/shows/${showId}?saved=payment`);
}

export async function updateShowPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const showId = String(formData.get("show_id") ?? "");
  const paymentId = String(formData.get("payment_id") ?? "");
  const memberName = String(formData.get("member_name") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const paid = formData.get("paid") === "on";

  if (!showId || !paymentId || !memberName || !Number.isFinite(amount) || amount < 0) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        "Band member and a valid payment amount are required."
      )}`
    );
  }

  const { error } = await supabase
    .from("show_payments")
    .update({
      member_name: memberName,
      amount,
      paid,
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", paymentId)
    .eq("show_id", showId);

  if (error) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/admin/shows");
  revalidatePath(`/admin/shows/${showId}`);
  redirect(`/admin/shows/${showId}?saved=payment-edited`);
}

export async function toggleShowPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const showId = String(formData.get("show_id") ?? "");
  const paymentId = String(formData.get("payment_id") ?? "");
  const paid = formData.get("paid") === "true";

  const { error } = await supabase
    .from("show_payments")
    .update({ paid, paid_at: paid ? new Date().toISOString() : null })
    .eq("id", paymentId)
    .eq("show_id", showId);

  if (error) redirect(`/admin/shows/${showId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/admin/shows/${showId}`);
  redirect(`/admin/shows/${showId}?saved=payment`);
}

export async function deleteShowPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const showId = String(formData.get("show_id") ?? "");
  const paymentId = String(formData.get("payment_id") ?? "");

  const { error } = await supabase
    .from("show_payments")
    .delete()
    .eq("id", paymentId)
    .eq("show_id", showId);

  if (error) redirect(`/admin/shows/${showId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/admin/shows/${showId}`);
  redirect(`/admin/shows/${showId}?saved=payment-deleted`);
}

export async function deleteShow(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const showId = String(formData.get("show_id") ?? "");

  if (!showId) {
    throw new Error("Show ID is missing.");
  }

  const { error } = await supabase.rpc("delete_show_cascade", {
    p_show_id: showId,
  });

  if (error) {
    redirect(
      `/admin/shows/${showId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/shows");
  revalidatePath("/admin/reports");
  revalidatePath("/shows");

  redirect("/admin/shows?deleted=true");
}


export async function addBandMember(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!name) redirect(`/admin/band-members?error=${encodeURIComponent("Band member name is required.")}`);

  const { error } = await supabase.from("band_members").insert({
    name,
    role: role || null,
    active: true,
    sort_order: Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : 0,
  });

  if (error) redirect(`/admin/band-members?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/band-members");
  redirect("/admin/band-members?saved=added");
}

export async function updateBandMember(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const memberId = String(formData.get("member_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  const active = formData.get("active") === "on";

  if (!memberId || !name) redirect(`/admin/band-members?error=${encodeURIComponent("Band member and name are required.")}`);

  const { error } = await supabase
    .from("band_members")
    .update({
      name,
      role: role || null,
      active,
      sort_order: Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (error) redirect(`/admin/band-members?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/band-members");
  redirect("/admin/band-members?saved=updated");
}

export async function deleteBandMember(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const memberId = String(formData.get("member_id") ?? "");
  if (!memberId) redirect(`/admin/band-members?error=${encodeURIComponent("Band member ID is missing.")}`);

  const { error } = await supabase.from("band_members").delete().eq("id", memberId);
  if (error) redirect(`/admin/band-members?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/band-members");
  redirect("/admin/band-members?saved=deleted");
}
