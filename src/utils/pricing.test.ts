import {
  calculateTicketMultiplier,
  calculateUsageCharges,
  calculateCancellationFee,
  validateUsageInput,
  Room,
  UsageInput,
  EquipmentUsageInput,
} from './pricing';

// Mock HolidayService
jest.mock('../services/HolidayService', () => ({
  __esModule: true,
  default: {
    isWeekendOrHoliday: jest.fn().mockResolvedValue(false), // Default to weekday
  },
}));

import HolidayService from '../services/HolidayService';

describe('Pricing Module', () => {
  // Sample room data for testing
  const sampleRoom: Room = {
    id: 1,
    name: 'Multipurpose Hall',
    basePriceMorning: 15000,
    basePriceAfternoon: 20000,
    basePriceEvening: 18000,
    extensionPriceMidday: 3000,
    extensionPriceEvening: 3000,
    weekendPriceMorning: 18000, // Weekend pricing
    weekendPriceAfternoon: 24000,
    weekendPriceEvening: 21600,
    weekendExtensionPriceMidday: 3600,
    weekendExtensionPriceEvening: 3600,
    acPricePerHour: 1000,
  };

  const testWeekdayDate = '2025-01-15'; // Wednesday
  const testWeekendDate = '2025-01-18'; // Saturday

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTicketMultiplier', () => {
    it('should return 1.0 for free entrance', () => {
      expect(calculateTicketMultiplier('free', 0)).toBe(1.0);
    });

    it('should return 1.0 for paid but 0 yen entrance', () => {
      expect(calculateTicketMultiplier('paid', 0)).toBe(1.0);
    });

    it('should return 1.5 for entrance fee of 1 yen', () => {
      expect(calculateTicketMultiplier('paid', 1)).toBe(1.5);
    });

    it('should return 1.5 for entrance fee of 3000 yen', () => {
      expect(calculateTicketMultiplier('paid', 3000)).toBe(1.5);
    });

    it('should return 2.0 for entrance fee of 3001 yen', () => {
      expect(calculateTicketMultiplier('paid', 3001)).toBe(2.0);
    });

    it('should return 2.0 for entrance fee of 5000 yen', () => {
      expect(calculateTicketMultiplier('paid', 5000)).toBe(2.0);
    });
  });

  describe('calculateUsageCharges - Weekday Pricing', () => {
    beforeEach(() => {
      (HolidayService.isWeekendOrHoliday as jest.Mock).mockResolvedValue(false);
    });

    it('should calculate charge for morning slot only', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = await calculateUsageCharges(sampleRoom, usage, [], 1.0, testWeekdayDate);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000);
      expect(result.roomChargeAfterMultiplier).toBe(15000);
      expect(result.equipmentCharge).toBe(0);
      expect(result.acCharge).toBe(0);
      expect(result.subtotalAmount).toBe(15000);
    });

    it('should calculate charge for afternoon slot only', async () => {
      const usage: UsageInput = {
        useMorning: false,
        useAfternoon: true,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = await calculateUsageCharges(sampleRoom, usage, [], 1.0, testWeekdayDate);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(20000);
      expect(result.roomChargeAfterMultiplier).toBe(20000);
    });

    it('should calculate charge for all three main slots', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: true,
        useEvening: true,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = await calculateUsageCharges(sampleRoom, usage, [], 1.0, testWeekdayDate);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000 + 20000 + 18000);
      expect(result.roomChargeAfterMultiplier).toBe(53000);
    });
  });

  describe('calculateUsageCharges - Weekend/Holiday Pricing', () => {
    beforeEach(() => {
      (HolidayService.isWeekendOrHoliday as jest.Mock).mockResolvedValue(true);
    });

    it('should apply weekend pricing for morning slot', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = await calculateUsageCharges(sampleRoom, usage, [], 1.0, testWeekendDate);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(18000); // Weekend price
      expect(result.roomChargeAfterMultiplier).toBe(18000);
    });

    it('should apply weekend pricing for all slots', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: true,
        useEvening: true,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = await calculateUsageCharges(sampleRoom, usage, [], 1.0, testWeekendDate);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(18000 + 24000 + 21600);
      expect(result.roomChargeAfterMultiplier).toBe(63600);
    });
  });

  describe('calculateUsageCharges - Extension Blocks', () => {
    beforeEach(() => {
      (HolidayService.isWeekendOrHoliday as jest.Mock).mockResolvedValue(false);
    });

    it('should charge for midday extension when only morning is booked', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: true,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = await calculateUsageCharges(sampleRoom, usage, [], 1.0, testWeekdayDate);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000 + 3000);
      expect(result.roomChargeAfterMultiplier).toBe(18000);
    });

    it('should NOT charge for midday extension when both morning and afternoon are booked', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: true,
        useEvening: false,
        useMiddayExtension: true,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = await calculateUsageCharges(sampleRoom, usage, [], 1.0, testWeekdayDate);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000 + 20000);
      expect(result.roomChargeAfterMultiplier).toBe(35000);
    });
  });

  describe('calculateUsageCharges - Entrance Fee Multiplier', () => {
    beforeEach(() => {
      (HolidayService.isWeekendOrHoliday as jest.Mock).mockResolvedValue(false);
    });

    it('should apply 1.5x multiplier to room charge only', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = await calculateUsageCharges(sampleRoom, usage, [], 1.5, testWeekdayDate);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000);
      expect(result.roomChargeAfterMultiplier).toBe(22500); // 15000 * 1.5
    });

    it('should apply 2.0x multiplier to room charge only', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = await calculateUsageCharges(sampleRoom, usage, [], 2.0, testWeekdayDate);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000);
      expect(result.roomChargeAfterMultiplier).toBe(30000); // 15000 * 2.0
    });
  });

  describe('calculateUsageCharges - Equipment', () => {
    beforeEach(() => {
      (HolidayService.isWeekendOrHoliday as jest.Mock).mockResolvedValue(false);
    });

    it('should calculate per_slot equipment charge', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: true,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const equipment: EquipmentUsageInput[] = [
        {
          equipmentId: 1,
          priceType: 'per_slot',
          unitPrice: 500,
          quantity: 1,
          slotCount: 2,
        },
      ];

      const result = await calculateUsageCharges(sampleRoom, usage, equipment, 1.0, testWeekdayDate);

      expect(result.equipmentCharge).toBe(500 * 1 * 2); // 1000
      expect(result.subtotalAmount).toBe(35000 + 1000);
    });

    it('should NOT apply entrance fee multiplier to equipment charge', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const equipment: EquipmentUsageInput[] = [
        { equipmentId: 1, priceType: 'per_slot', unitPrice: 500, quantity: 1, slotCount: 1 },
      ];

      const result = await calculateUsageCharges(sampleRoom, usage, equipment, 2.0, testWeekdayDate);

      expect(result.roomChargeAfterMultiplier).toBe(30000); // 15000 * 2.0
      expect(result.equipmentCharge).toBe(500); // NOT multiplied
      expect(result.subtotalAmount).toBe(30500);
    });
  });

  describe('calculateUsageCharges - Air Conditioning', () => {
    beforeEach(() => {
      (HolidayService.isWeekendOrHoliday as jest.Mock).mockResolvedValue(false);
    });

    it('should calculate AC charge based on actual hours', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: true,
        acHours: 2.5,
      };

      const result = await calculateUsageCharges(sampleRoom, usage, [], 1.0, testWeekdayDate);

      expect(result.acCharge).toBe(2500); // 2.5 * 1000
      expect(result.subtotalAmount).toBe(15000 + 2500);
    });

    it('should NOT apply entrance fee multiplier to AC charge', async () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: true,
        acHours: 2.0,
      };

      const result = await calculateUsageCharges(sampleRoom, usage, [], 2.0, testWeekdayDate);

      expect(result.roomChargeAfterMultiplier).toBe(30000); // 15000 * 2.0
      expect(result.acCharge).toBe(2000); // NOT multiplied
      expect(result.subtotalAmount).toBe(32000);
    });
  });

  describe('calculateCancellationFee', () => {
    it('should return 0 when not cancelled', () => {
      const usageDate = new Date('2025-12-25');
      const fee = calculateCancellationFee(usageDate, null, 10000);
      expect(fee).toBe(0);
    });

    it('should return 0 when cancelled before usage date', () => {
      const usageDate = new Date('2025-12-25');
      const cancelledAt = new Date('2025-12-24T23:59:59');
      const fee = calculateCancellationFee(usageDate, cancelledAt, 10000);
      expect(fee).toBe(0);
    });

    it('should return full amount when cancelled on usage date', () => {
      const usageDate = new Date('2025-12-25');
      const cancelledAt = new Date('2025-12-25T08:00:00');
      const fee = calculateCancellationFee(usageDate, cancelledAt, 10000);
      expect(fee).toBe(10000);
    });
  });

  describe('validateUsageInput', () => {
    it('should validate usage with at least one main slot', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = validateUsageInput(usage);
      expect(result.valid).toBe(true);
    });

    it('should reject usage with no main slots', () => {
      const usage: UsageInput = {
        useMorning: false,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: true,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = validateUsageInput(usage);
      expect(result.valid).toBe(false);
    });
  });
});
