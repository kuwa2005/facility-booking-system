/**
 * 施設予約システムの料金計算モジュール
 *
 * このモジュールは以下の料金計算ロジックを実装しています：
 * - 部屋の基本料金と延長料金
 * - 入場料倍率
 * - 設備料金
 * - 空調料金
 * - キャンセル料金
 */

export interface Room {
  id: number;
  name: string;
  basePriceMorning: number;      // 午前の基本料金
  basePriceAfternoon: number;    // 午後の基本料金
  basePriceEvening: number;      // 夜間の基本料金
  extensionPriceMidday: number;  // 正午延長料金
  extensionPriceEvening: number; // 夕方延長料金
  acPricePerHour: number;       // 空調の時間単価
}

export interface UsageInput {
  useMorning: boolean;           // 午前を使用
  useAfternoon: boolean;         // 午後を使用
  useEvening: boolean;           // 夜間を使用
  useMiddayExtension: boolean;   // 正午延長を使用
  useEveningExtension: boolean;  // 夕方延長を使用
  acRequested: boolean;          // 空調を要求
  acHours?: number;              // 実際の使用時間（予約時はnullの可能性あり）
}

export interface EquipmentUsageInput {
  equipmentId: number;                      // 設備ID
  priceType: 'per_slot' | 'flat' | 'free'; // 料金タイプ
  unitPrice: number;                        // 単価
  quantity: number;                         // 数量
  slotCount: number;                        // 主要枠数（午前、午後、夜間）
}

export interface UsageCharges {
  roomBaseChargeBeforeMultiplier: number; // 倍率適用前の部屋料金
  roomChargeAfterMultiplier: number;      // 倍率適用後の部屋料金
  equipmentCharge: number;                 // 設備料金
  acCharge: number;                        // 空調料金
  subtotalAmount: number;                  // 小計金額
}

/**
 * 入場料金額に基づいて入場料倍率を計算
 *
 * ルール：
 * - 無料（0円）: 1.0倍
 * - 1〜3000円: 1.5倍
 * - 3001円以上: 2.0倍
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
 * 使用している主要枠（午前、午後、夜間）の数を計算
 */
function countMainSlots(usage: UsageInput): number {
  let count = 0;
  if (usage.useMorning) count++;
  if (usage.useAfternoon) count++;
  if (usage.useEvening) count++;
  return count;
}

/**
 * 主要枠と延長枠を含む部屋の基本料金を計算
 *
 * ルール：
 * - 主要枠は基本料金で課金
 * - 延長枠は隣接する両方の枠が予約されている場合は無料
 * - 延長枠は連続予約なしで使用される場合は課金
 */
function calculateRoomBaseCharge(room: Room, usage: UsageInput): number {
  let charge = 0;

  // 基本枠の料金を追加
  if (usage.useMorning) {
    charge += room.basePriceMorning;
  }

  if (usage.useAfternoon) {
    charge += room.basePriceAfternoon;
  }

  if (usage.useEvening) {
    charge += room.basePriceEvening;
  }

  // 正午延長（12:00-13:00、午前と午後の間）を処理
  if (usage.useMiddayExtension) {
    // 午前と午後の両方が予約されている場合は無料
    const isFree = usage.useMorning && usage.useAfternoon;
    if (!isFree) {
      charge += room.extensionPriceMidday;
    }
  }

  // 夕方延長（17:00-18:00、午後と夜間の間）を処理
  if (usage.useEveningExtension) {
    // 午後と夜間の両方が予約されている場合は無料
    const isFree = usage.useAfternoon && usage.useEvening;
    if (!isFree) {
      charge += room.extensionPriceEvening;
    }
  }

  return charge;
}

/**
 * 料金タイプと数量に基づいて設備料金を計算
 */
function calculateEquipmentCharge(equipmentUsages: EquipmentUsageInput[]): number {
  let total = 0;

  for (const equipment of equipmentUsages) {
    if (equipment.priceType === 'free') {
      continue;
    }

    if (equipment.priceType === 'per_slot') {
      // 料金 = 単価 × 数量 × 枠数
      total += equipment.unitPrice * equipment.quantity * equipment.slotCount;
    } else if (equipment.priceType === 'flat') {
      // 料金 = 単価（定額料金、枠数は無視）
      total += equipment.unitPrice;
    }
  }

  return total;
}

/**
 * 空調料金を計算
 *
 * 料金 = 実使用時間 × 時間単価
 */
function calculateAcCharge(room: Room, usage: UsageInput): number {
  if (!usage.acRequested || !usage.acHours || usage.acHours <= 0) {
    return 0;
  }

  return Math.round(usage.acHours * room.acPricePerHour);
}

/**
 * 1つの使用明細のすべての料金を計算
 *
 * @param room - 使用する部屋
 * @param usageInput - 使用詳細（枠、空調など）
 * @param equipmentUsages - 使用する設備
 * @param ticketMultiplier - 入場料に基づく倍率（1.0、1.5、または2.0）
 * @returns すべての料金の詳細内訳
 */
export function calculateUsageCharges(
  room: Room,
  usageInput: UsageInput,
  equipmentUsages: EquipmentUsageInput[],
  ticketMultiplier: number
): UsageCharges {
  // 部屋の基本料金を計算（倍率適用前）
  const roomBaseChargeBeforeMultiplier = calculateRoomBaseCharge(room, usageInput);

  // 入場料倍率を部屋料金のみに適用
  const roomChargeAfterMultiplier = Math.round(roomBaseChargeBeforeMultiplier * ticketMultiplier);

  // 設備料金を計算（倍率の影響を受けない）
  const equipmentCharge = calculateEquipmentCharge(equipmentUsages);

  // 空調料金を計算（倍率の影響を受けない）
  const acCharge = calculateAcCharge(room, usageInput);

  // 小計合計
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
 * キャンセル日と使用日に基づいてキャンセル料金を計算
 *
 * ルール：
 * - 使用日前（暦日）にキャンセル: 0%（料金なし）
 * - 使用日当日以降にキャンセル: 100%（全額）
 *
 * @param usageDate - 予定されている使用日
 * @param cancelledAt - キャンセルが発生した日時（キャンセルされていない場合はnull）
 * @param subtotalAmount - この使用に対して課金される合計金額
 * @returns キャンセル料金額
 */
export function calculateCancellationFee(
  usageDate: Date,
  cancelledAt: Date | null,
  subtotalAmount: number
): number {
  // キャンセルされていない
  if (!cancelledAt) {
    return 0;
  }

  // 暦日を比較（時刻は無視）
  const usageDateOnly = new Date(usageDate.getFullYear(), usageDate.getMonth(), usageDate.getDate());
  const cancelledDateOnly = new Date(
    cancelledAt.getFullYear(),
    cancelledAt.getMonth(),
    cancelledAt.getDate()
  );

  // 使用日前にキャンセルされた場合: 0%料金
  if (cancelledDateOnly < usageDateOnly) {
    return 0;
  }

  // 使用日当日以降にキャンセルされた場合: 100%料金
  return subtotalAmount;
}

/**
 * 複数の使用から申請合計金額を計算するヘルパー関数
 */
export function calculateApplicationTotal(usageCharges: UsageCharges[]): number {
  return usageCharges.reduce((total, usage) => total + usage.subtotalAmount, 0);
}

/**
 * 少なくとも1つの枠が選択されていることを確認するために使用入力を検証
 */
export function validateUsageInput(usage: UsageInput): { valid: boolean; error?: string } {
  const hasMainSlot = usage.useMorning || usage.useAfternoon || usage.useEvening;

  if (!hasMainSlot) {
    return {
      valid: false,
      error: '少なくとも1つの主要時間枠（午前、午後、または夜間）を選択する必要があります',
    };
  }

  // 延長枠には少なくとも1つの隣接する主要枠が必要
  if (usage.useMiddayExtension && !usage.useMorning && !usage.useAfternoon) {
    return {
      valid: false,
      error: '正午延長には午前または午後の枠を選択する必要があります',
    };
  }

  if (usage.useEveningExtension && !usage.useAfternoon && !usage.useEvening) {
    return {
      valid: false,
      error: '夕方延長には午後または夜間の枠を選択する必要があります',
    };
  }

  return { valid: true };
}
