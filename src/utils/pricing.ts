/**
 * Pricing calculation module for facility reservation system
 *
 * This module implements all pricing logic including:
 * - Room base charges and extension charges
 * - Entrance fee multipliers
 * - Equipment charges
 * - Air conditioning charges
 * - Cancellation fees
 */

export interface Room {
  id: number;
  name: string;
  base_price_morning: number;
  base_price_afternoon: number;
  base_price_evening: number;
  extension_price_midday: number;
  extension_price_evening: number;
  ac_price_per_hour: number;
}

export interface UsageInput {
  useMorning: boolean;
  useAfternoon: boolean;
  useEvening: boolean;
  useMiddayExtension: boolean;
  useEveningExtension: boolean;
  acRequested: boolean;
  acHours?: number; // Actual hours used (may be null during reservation)
}

export interface EquipmentUsageInput {
  equipmentId: number;
  priceType: 'per_slot' | 'flat' | 'free';
  unitPrice: number;
  quantity: number;
  slotCount: number; // Number of main slots (morning, afternoon, evening)
}

export interface UsageCharges {
  roomBaseChargeBeforeMultiplier: number;
  roomChargeAfterMultiplier: number;
  equipmentCharge: number;
  acCharge: number;
  subtotalAmount: number;
}

/**
 * Calculate the ticket multiplier based on entrance fee amount
 *
 * Rules:
 * - Free (0 yen): 1.0x
 * - 1-3000 yen: 1.5x
 * - 3001+ yen: 2.0x
 */
export function calculateTicketMultiplier(
  entranceFeeType: 'free' | 'paid',
  entranceFeeAmount: number
): number {
  if (entranceFeeType === 'free' || entranceFeeAmount === 0) {
    return 1.0;
  }

  if (entranceFeeAmount >= 1 && entranceFeeAmount <= 3000) {
    return 1.5;
  }

  if (entranceFeeAmount >= 3001) {
    return 2.0;
  }

  return 1.0;
}

/**
 * Calculate the number of main slots (morning, afternoon, evening) being used
 */
function countMainSlots(usage: UsageInput): number {
  let count = 0;
  if (usage.useMorning) count++;
  if (usage.useAfternoon) count++;
  if (usage.useEvening) count++;
  return count;
}

/**
 * Calculate room base charges including main slots and extension blocks
 *
 * Rules:
 * - Main slots are charged at their base prices
 * - Extension blocks are FREE if both adjacent slots are booked
 * - Extension blocks are CHARGED if used without continuous adjacent booking
 */
function calculateRoomBaseCharge(room: Room, usage: UsageInput): number {
  let charge = 0;

  // Add base slot charges
  if (usage.useMorning) {
    charge += room.base_price_morning;
  }

  if (usage.useAfternoon) {
    charge += room.base_price_afternoon;
  }

  if (usage.useEvening) {
    charge += room.base_price_evening;
  }

  // Handle midday extension (12:00-13:00, between Morning and Afternoon)
  if (usage.useMiddayExtension) {
    // Free if both Morning AND Afternoon are booked
    const isFree = usage.useMorning && usage.useAfternoon;
    if (!isFree) {
      charge += room.extension_price_midday;
    }
  }

  // Handle evening extension (17:00-18:00, between Afternoon and Evening)
  if (usage.useEveningExtension) {
    // Free if both Afternoon AND Evening are booked
    const isFree = usage.useAfternoon && usage.useEvening;
    if (!isFree) {
      charge += room.extension_price_evening;
    }
  }

  return charge;
}

/**
 * Calculate equipment charges based on price type and quantity
 */
function calculateEquipmentCharge(equipmentUsages: EquipmentUsageInput[]): number {
  let total = 0;

  for (const equipment of equipmentUsages) {
    if (equipment.priceType === 'free') {
      continue;
    }

    if (equipment.priceType === 'per_slot') {
      // Charge = unit_price * quantity * slot_count
      total += equipment.unitPrice * equipment.quantity * equipment.slotCount;
    } else if (equipment.priceType === 'flat') {
      // Charge = unit_price (flat fee, ignore slot_count)
      total += equipment.unitPrice;
    }
  }

  return total;
}

/**
 * Calculate air conditioning charge
 *
 * Charge = actual_hours * ac_price_per_hour
 */
function calculateAcCharge(room: Room, usage: UsageInput): number {
  if (!usage.acRequested || !usage.acHours || usage.acHours <= 0) {
    return 0;
  }

  return Math.round(usage.acHours * room.ac_price_per_hour);
}

/**
 * Calculate all charges for a single usage line
 *
 * @param room - The room being used
 * @param usageInput - Usage details (slots, AC, etc.)
 * @param equipmentUsages - Equipment being used
 * @param ticketMultiplier - Multiplier based on entrance fee (1.0, 1.5, or 2.0)
 * @returns Detailed breakdown of all charges
 */
export function calculateUsageCharges(
  room: Room,
  usageInput: UsageInput,
  equipmentUsages: EquipmentUsageInput[],
  ticketMultiplier: number
): UsageCharges {
  // Calculate room base charge (before multiplier)
  const roomBaseChargeBeforeMultiplier = calculateRoomBaseCharge(room, usageInput);

  // Apply entrance fee multiplier to room charge ONLY
  const roomChargeAfterMultiplier = Math.round(roomBaseChargeBeforeMultiplier * ticketMultiplier);

  // Calculate equipment charge (NOT affected by multiplier)
  const equipmentCharge = calculateEquipmentCharge(equipmentUsages);

  // Calculate AC charge (NOT affected by multiplier)
  const acCharge = calculateAcCharge(room, usageInput);

  // Total subtotal
  const subtotalAmount = roomChargeAfterMultiplier + equipmentCharge + acCharge;

  return {
    roomBaseChargeBeforeMultiplier,
    roomChargeAfterMultiplier,
    equipmentCharge,
    acCharge,
    subtotalAmount,
  };
}

/**
 * Calculate cancellation fee based on cancellation date and usage date
 *
 * Rules:
 * - If cancelled BEFORE the usage date (calendar date): 0% (no fee)
 * - If cancelled ON or AFTER the usage date: 100% (full charge)
 *
 * @param usageDate - The date of the scheduled usage
 * @param cancelledAt - The datetime when cancellation occurred (null if not cancelled)
 * @param subtotalAmount - The total amount to be charged for this usage
 * @returns Cancellation fee amount
 */
export function calculateCancellationFee(
  usageDate: Date,
  cancelledAt: Date | null,
  subtotalAmount: number
): number {
  // Not cancelled
  if (!cancelledAt) {
    return 0;
  }

  // Compare calendar dates (ignore time)
  const usageDateOnly = new Date(usageDate.getFullYear(), usageDate.getMonth(), usageDate.getDate());
  const cancelledDateOnly = new Date(
    cancelledAt.getFullYear(),
    cancelledAt.getMonth(),
    cancelledAt.getDate()
  );

  // If cancelled before the usage date: 0% fee
  if (cancelledDateOnly < usageDateOnly) {
    return 0;
  }

  // If cancelled on or after the usage date: 100% fee
  return subtotalAmount;
}

/**
 * Helper function to calculate total application amount from multiple usages
 */
export function calculateApplicationTotal(usageCharges: UsageCharges[]): number {
  return usageCharges.reduce((total, usage) => total + usage.subtotalAmount, 0);
}

/**
 * Validate usage input to ensure at least one slot is selected
 */
export function validateUsageInput(usage: UsageInput): { valid: boolean; error?: string } {
  const hasMainSlot = usage.useMorning || usage.useAfternoon || usage.useEvening;

  if (!hasMainSlot) {
    return {
      valid: false,
      error: 'At least one main time slot (morning, afternoon, or evening) must be selected',
    };
  }

  // Extension blocks require at least one adjacent main slot
  if (usage.useMiddayExtension && !usage.useMorning && !usage.useAfternoon) {
    return {
      valid: false,
      error: 'Midday extension requires morning or afternoon slot to be selected',
    };
  }

  if (usage.useEveningExtension && !usage.useAfternoon && !usage.useEvening) {
    return {
      valid: false,
      error: 'Evening extension requires afternoon or evening slot to be selected',
    };
  }

  return { valid: true };
}
