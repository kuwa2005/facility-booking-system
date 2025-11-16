import {
  calculateTicketMultiplier,
  calculateUsageCharges,
  calculateCancellationFee,
  validateUsageInput,
  Room,
  UsageInput,
  EquipmentUsageInput,
} from './pricing';

describe('Pricing Module', () => {
  // Sample room data for testing
  const sampleRoom: Room = {
    id: 1,
    name: 'Multipurpose Hall',
    base_price_morning: 15000,
    base_price_afternoon: 20000,
    base_price_evening: 18000,
    extension_price_midday: 3000,
    extension_price_evening: 3000,
    ac_price_per_hour: 1000,
  };

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

  describe('calculateUsageCharges - Basic Slots', () => {
    it('should calculate charge for morning slot only', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.0);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000);
      expect(result.roomChargeAfterMultiplier).toBe(15000);
      expect(result.equipmentCharge).toBe(0);
      expect(result.acCharge).toBe(0);
      expect(result.subtotalAmount).toBe(15000);
    });

    it('should calculate charge for afternoon slot only', () => {
      const usage: UsageInput = {
        useMorning: false,
        useAfternoon: true,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.0);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(20000);
      expect(result.roomChargeAfterMultiplier).toBe(20000);
    });

    it('should calculate charge for all three main slots', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: true,
        useEvening: true,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.0);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000 + 20000 + 18000);
      expect(result.roomChargeAfterMultiplier).toBe(53000);
    });
  });

  describe('calculateUsageCharges - Extension Blocks', () => {
    it('should charge for midday extension when only morning is booked', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: true,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.0);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000 + 3000);
      expect(result.roomChargeAfterMultiplier).toBe(18000);
    });

    it('should NOT charge for midday extension when both morning and afternoon are booked', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: true,
        useEvening: false,
        useMiddayExtension: true,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.0);

      // Should NOT include extension_price_midday
      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000 + 20000);
      expect(result.roomChargeAfterMultiplier).toBe(35000);
    });

    it('should charge for evening extension when only afternoon is booked', () => {
      const usage: UsageInput = {
        useMorning: false,
        useAfternoon: true,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: true,
        acRequested: false,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.0);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(20000 + 3000);
      expect(result.roomChargeAfterMultiplier).toBe(23000);
    });

    it('should NOT charge for evening extension when both afternoon and evening are booked', () => {
      const usage: UsageInput = {
        useMorning: false,
        useAfternoon: true,
        useEvening: true,
        useMiddayExtension: false,
        useEveningExtension: true,
        acRequested: false,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.0);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(20000 + 18000);
      expect(result.roomChargeAfterMultiplier).toBe(38000);
    });

    it('should NOT charge for both extensions when all slots are booked', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: true,
        useEvening: true,
        useMiddayExtension: true,
        useEveningExtension: true,
        acRequested: false,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.0);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000 + 20000 + 18000);
      expect(result.roomChargeAfterMultiplier).toBe(53000);
    });
  });

  describe('calculateUsageCharges - Entrance Fee Multiplier', () => {
    it('should apply 1.5x multiplier to room charge only', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.5);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000);
      expect(result.roomChargeAfterMultiplier).toBe(22500); // 15000 * 1.5
    });

    it('should apply 2.0x multiplier to room charge only', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 2.0);

      expect(result.roomBaseChargeBeforeMultiplier).toBe(15000);
      expect(result.roomChargeAfterMultiplier).toBe(30000); // 15000 * 2.0
    });
  });

  describe('calculateUsageCharges - Equipment', () => {
    it('should calculate per_slot equipment charge', () => {
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
          slotCount: 2, // 2 slots (morning + afternoon)
        },
      ];

      const result = calculateUsageCharges(sampleRoom, usage, equipment, 1.0);

      expect(result.equipmentCharge).toBe(500 * 1 * 2); // 1000
      expect(result.subtotalAmount).toBe(35000 + 1000);
    });

    it('should calculate flat equipment charge', () => {
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
          equipmentId: 2,
          priceType: 'flat',
          unitPrice: 3000,
          quantity: 1,
          slotCount: 2, // Ignored for flat pricing
        },
      ];

      const result = calculateUsageCharges(sampleRoom, usage, equipment, 1.0);

      expect(result.equipmentCharge).toBe(3000);
    });

    it('should not charge for free equipment', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const equipment: EquipmentUsageInput[] = [
        {
          equipmentId: 3,
          priceType: 'free',
          unitPrice: 0,
          quantity: 1,
          slotCount: 1,
        },
      ];

      const result = calculateUsageCharges(sampleRoom, usage, equipment, 1.0);

      expect(result.equipmentCharge).toBe(0);
    });

    it('should calculate multiple equipment items correctly', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: true,
        useEvening: true,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
      };

      const equipment: EquipmentUsageInput[] = [
        { equipmentId: 1, priceType: 'per_slot', unitPrice: 500, quantity: 1, slotCount: 3 },
        { equipmentId: 2, priceType: 'flat', unitPrice: 3000, quantity: 1, slotCount: 3 },
        { equipmentId: 3, priceType: 'per_slot', unitPrice: 200, quantity: 2, slotCount: 3 },
      ];

      const result = calculateUsageCharges(sampleRoom, usage, equipment, 1.0);

      // per_slot: 500*1*3 = 1500
      // flat: 3000
      // per_slot: 200*2*3 = 1200
      expect(result.equipmentCharge).toBe(1500 + 3000 + 1200); // 5700
    });

    it('should NOT apply entrance fee multiplier to equipment charge', () => {
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

      const result = calculateUsageCharges(sampleRoom, usage, equipment, 2.0);

      expect(result.roomChargeAfterMultiplier).toBe(30000); // 15000 * 2.0
      expect(result.equipmentCharge).toBe(500); // NOT multiplied
      expect(result.subtotalAmount).toBe(30500);
    });
  });

  describe('calculateUsageCharges - Air Conditioning', () => {
    it('should calculate AC charge based on actual hours', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: true,
        acHours: 2.5,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.0);

      expect(result.acCharge).toBe(2500); // 2.5 * 1000
      expect(result.subtotalAmount).toBe(15000 + 2500);
    });

    it('should return 0 AC charge when not requested', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: false,
        acHours: 2.5,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.0);

      expect(result.acCharge).toBe(0);
    });

    it('should return 0 AC charge when hours not provided', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: true,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 1.0);

      expect(result.acCharge).toBe(0);
    });

    it('should NOT apply entrance fee multiplier to AC charge', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: false,
        acRequested: true,
        acHours: 2.0,
      };

      const result = calculateUsageCharges(sampleRoom, usage, [], 2.0);

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

    it('should return full amount when cancelled after usage date', () => {
      const usageDate = new Date('2025-12-25');
      const cancelledAt = new Date('2025-12-26T10:00:00');
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
      expect(result.error).toContain('At least one main time slot');
    });

    it('should reject midday extension without adjacent slots', () => {
      const usage: UsageInput = {
        useMorning: false,
        useAfternoon: false,
        useEvening: true,
        useMiddayExtension: true,
        useEveningExtension: false,
        acRequested: false,
      };

      const result = validateUsageInput(usage);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Midday extension');
    });

    it('should reject evening extension without adjacent slots', () => {
      const usage: UsageInput = {
        useMorning: true,
        useAfternoon: false,
        useEvening: false,
        useMiddayExtension: false,
        useEveningExtension: true,
        acRequested: false,
      };

      const result = validateUsageInput(usage);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Evening extension');
    });
  });
});
