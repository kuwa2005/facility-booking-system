import { pool } from '../config/database';
import { ResultSetHeader } from 'mysql2';

/**
 * ユーザーアクティビティログサービス
 * 一般ユーザーの詳細な行動を記録してマーケティング分析に活用
 */
export class UserActivityLogService {
  /**
   * アクティビティログを記録
   */
  static async log(
    userId: number,
    actionType: string,
    description: string,
    targetType?: string | null,
    targetId?: number | null,
    metadata?: any,
    ipAddress?: string | null,
    userAgent?: string | null
  ): Promise<void> {
    try {
      // メタデータをJSON文字列に変換
      const metadataJson = metadata ? JSON.stringify(metadata) : null;

      await pool.query(
        `INSERT INTO user_activity_logs
         (user_id, action_type, target_type, target_id, description, metadata, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          actionType,
          targetType || null,
          targetId || null,
          description,
          metadataJson,
          ipAddress || null,
          userAgent || null,
        ]
      );
    } catch (error) {
      console.error('Failed to log user activity:', error);
      // ログ記録の失敗でメイン処理を止めないようにエラーを握りつぶす
    }
  }

  /**
   * 部屋閲覧を記録
   */
  static async logRoomView(
    userId: number,
    roomId: number,
    roomName: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'view_room',
      `部屋「${roomName}」を閲覧しました`,
      'room',
      roomId,
      { roomId, roomName },
      ipAddress,
      userAgent
    );
  }

  /**
   * 予約フォームアクセスを記録
   */
  static async logBookingFormAccess(
    userId: number,
    roomId: number,
    roomName: string,
    selectedDate?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'access_booking_form',
      `部屋「${roomName}」の予約フォームにアクセスしました`,
      'room',
      roomId,
      { roomId, roomName, selectedDate },
      ipAddress,
      userAgent
    );
  }

  /**
   * 予約作成試行を記録
   */
  static async logBookingAttempt(
    userId: number,
    roomId: number,
    roomName: string,
    dates: string[],
    totalAmount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'attempt_booking',
      `部屋「${roomName}」の予約を試行しました（${dates.length}日間、合計¥${totalAmount.toLocaleString()}）`,
      'room',
      roomId,
      { roomId, roomName, dates, totalAmount },
      ipAddress,
      userAgent
    );
  }

  /**
   * 予約作成成功を記録
   */
  static async logBookingSuccess(
    userId: number,
    applicationId: number,
    roomId: number,
    roomName: string,
    dates: string[],
    totalAmount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'create_booking',
      `部屋「${roomName}」の予約が完了しました（予約ID: ${applicationId}、${dates.length}日間、合計¥${totalAmount.toLocaleString()}）`,
      'application',
      applicationId,
      { applicationId, roomId, roomName, dates, totalAmount },
      ipAddress,
      userAgent
    );
  }

  /**
   * 予約キャンセル試行を記録
   */
  static async logCancelAttempt(
    userId: number,
    applicationId: number,
    eventName: string,
    totalAmount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'attempt_cancel',
      `予約「${eventName}」のキャンセルを試行しました（予約ID: ${applicationId}）`,
      'application',
      applicationId,
      { applicationId, eventName, totalAmount },
      ipAddress,
      userAgent
    );
  }

  /**
   * 予約キャンセル成功を記録
   */
  static async logCancelSuccess(
    userId: number,
    applicationId: number,
    eventName: string,
    cancellationFee: number,
    refundAmount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'cancel_booking',
      `予約「${eventName}」をキャンセルしました（キャンセル料: ¥${cancellationFee.toLocaleString()}、返金額: ¥${refundAmount.toLocaleString()}）`,
      'application',
      applicationId,
      { applicationId, eventName, cancellationFee, refundAmount },
      ipAddress,
      userAgent
    );
  }

  /**
   * 決済試行を記録
   */
  static async logPaymentAttempt(
    userId: number,
    applicationId: number,
    eventName: string,
    amount: number,
    paymentMethod?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'attempt_payment',
      `予約「${eventName}」の決済を試行しました（金額: ¥${amount.toLocaleString()}）`,
      'application',
      applicationId,
      { applicationId, eventName, amount, paymentMethod },
      ipAddress,
      userAgent
    );
  }

  /**
   * 決済成功を記録
   */
  static async logPaymentSuccess(
    userId: number,
    applicationId: number,
    eventName: string,
    amount: number,
    paymentMethod?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'complete_payment',
      `予約「${eventName}」の決済が完了しました（金額: ¥${amount.toLocaleString()}）`,
      'application',
      applicationId,
      { applicationId, eventName, amount, paymentMethod },
      ipAddress,
      userAgent
    );
  }

  /**
   * メッセージ送信を記録
   */
  static async logMessageSend(
    userId: number,
    messageId: number,
    subject: string,
    contentLength: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'send_message',
      `メッセージを送信しました（件名: ${subject}、本文: ${contentLength}文字）`,
      'message',
      messageId,
      { messageId, subject, contentLength },
      ipAddress,
      userAgent
    );
  }

  /**
   * お気に入り追加を記録
   */
  static async logFavoriteAdd(
    userId: number,
    roomId: number,
    roomName: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'add_favorite',
      `部屋「${roomName}」をお気に入りに追加しました`,
      'room',
      roomId,
      { roomId, roomName },
      ipAddress,
      userAgent
    );
  }

  /**
   * お気に入り削除を記録
   */
  static async logFavoriteRemove(
    userId: number,
    roomId: number,
    roomName: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'remove_favorite',
      `部屋「${roomName}」をお気に入りから削除しました`,
      'room',
      roomId,
      { roomId, roomName },
      ipAddress,
      userAgent
    );
  }

  /**
   * レビュー投稿を記録
   */
  static async logReviewPost(
    userId: number,
    reviewId: number,
    roomId: number,
    roomName: string,
    rating: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'post_review',
      `部屋「${roomName}」にレビューを投稿しました（評価: ${rating}）`,
      'review',
      reviewId,
      { reviewId, roomId, roomName, rating },
      ipAddress,
      userAgent
    );
  }

  /**
   * 検索実行を記録
   */
  static async logSearch(
    userId: number,
    searchQuery: string,
    searchType: string,
    resultsCount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'search',
      `検索を実行しました（クエリ: ${searchQuery}、種別: ${searchType}、結果: ${resultsCount}件）`,
      null,
      null,
      { searchQuery, searchType, resultsCount },
      ipAddress,
      userAgent
    );
  }

  /**
   * 空室確認を記録
   */
  static async logAvailabilityCheck(
    userId: number,
    roomId: number,
    roomName: string,
    yearMonth: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(
      userId,
      'check_availability',
      `「${roomName}」の空室状況を確認しました（${yearMonth}）`,
      'room',
      roomId,
      { roomId, roomName, yearMonth },
      ipAddress,
      userAgent
    );
  }
}

export default UserActivityLogService;
