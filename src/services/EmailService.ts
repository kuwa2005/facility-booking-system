import nodemailer, { Transporter } from 'nodemailer';

/**
 * メール送信サービス
 * Nodemailerを使用してメールを送信
 */
export class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * メール送信設定を初期化
   * デモ環境では外部メール送信を無効化し、ログのみ出力
   */
  private initializeTransporter(): void {
    try {
      // デモ環境では外部メール送信を無効化
      console.warn(
        '==============================================',
      );
      console.warn(
        'Email service running in DEMO MODE',
      );
      console.warn(
        'External email sending is DISABLED',
      );
      console.warn(
        'Emails will be logged to console only',
      );
      console.warn(
        '==============================================',
      );

      // transporterは作成しないが、設定済みとしてマーク
      this.transporter = null;
      this.isConfigured = true;
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * メールを送信（デモモード：ログ出力のみ）
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    from?: string;
  }): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
    if (!this.isConfigured) {
      console.error('Email service is not configured');
      return {
        success: false,
        error: 'Email service is not configured',
      };
    }

    try {
      const from =
        options.from || process.env.SMTP_FROM || 'no-reply@facility.local';

      // デモモード：メール内容をログ出力のみ（外部送信なし）
      console.log('=== [DEMO] Email (Not Sent Externally) ===');
      console.log('From:', from);
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('Text:', options.text || '(none)');
      console.log('HTML:', options.html ? '(HTML content present)' : '(none)');
      console.log('==========================================');

      // 疑似的なメッセージIDを生成
      const messageId = `demo-${Date.now()}@facility.local`;

      return {
        success: true,
        messageId: messageId,
      };
    } catch (error: any) {
      console.error('Failed to log email:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 複数のメールを一括送信
   */
  async sendBulkEmails(emails: Array<{
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }>): Promise<{
    success: number;
    failed: number;
    results: Array<{ to: string; success: boolean; messageId?: string; error?: string }>;
  }> {
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const email of emails) {
      const result = await this.sendEmail(email);

      results.push({
        to: email.to,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }

      // レート制限を避けるため、少し待機
      await this.sleep(100);
    }

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  /**
   * メールサービスの状態を確認（デモモード：常に成功）
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    // デモモードでは常に接続成功として扱う
    console.log('[DEMO] Email service is ready (no external connection)');
    return true;
  }

  /**
   * 待機処理
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * サービスが設定済みかチェック
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * 予約確認メールを送信
   */
  async sendReservationConfirmation(...args: any[]): Promise<any> {
    const [to] = args;
    return this.sendEmail({
      to,
      subject: '予約確認',
      html: `予約が確認されました。詳細: ${JSON.stringify(args)}`,
    });
  }

  /**
   * キャンセル通知メールを送信
   */
  async sendCancellationNotification(...args: any[]): Promise<any> {
    const [to] = args;
    return this.sendEmail({
      to,
      subject: '予約キャンセル通知',
      html: `予約がキャンセルされました。詳細: ${JSON.stringify(args)}`,
    });
  }

  /**
   * 管理者通知メールを送信
   */
  async sendAdminNotification(...args: any[]): Promise<any> {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@facility.local';
    return this.sendEmail({
      to: adminEmail,
      subject: '新規予約通知',
      html: `通知: ${JSON.stringify(args)}`,
    });
  }

  /**
   * 確認メール送信
   */
  async sendVerificationEmail(to: string, name: string, code: string): Promise<any> {
    return this.sendEmail({
      to,
      subject: 'メールアドレス確認',
      html: `${name}様、確認コード: ${code}`,
    });
  }

  /**
   * パスワードリセットメール送信
   */
  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<any> {
    return this.sendEmail({
      to,
      subject: 'パスワードリセット',
      html: `${name}様、リセットトークン: ${token}`,
    });
  }

  /**
   * 決済完了通知メール送信
   */
  async sendPaymentConfirmation(
    to: string,
    name: string,
    applicationId: number,
    eventName: string,
    amount: number
  ): Promise<any> {
    return this.sendEmail({
      to,
      subject: '【施設予約システム（DEMO）】決済完了のお知らせ',
      html: `
        <p>${name}様</p>
        <p>予約の決済が完了しました。</p>
        <hr>
        <p><strong>予約番号:</strong> #${applicationId}</p>
        <p><strong>イベント名:</strong> ${eventName}</p>
        <p><strong>決済金額:</strong> ¥${amount.toLocaleString()}</p>
        <hr>
        <p>ご利用ありがとうございました。</p>
        <p>※ これはデモシステムからの自動送信メールです。実際の決済は行われていません。</p>
      `,
      text: `${name}様\n\n予約の決済が完了しました。\n\n予約番号: #${applicationId}\nイベント名: ${eventName}\n決済金額: ¥${amount.toLocaleString()}\n\nご利用ありがとうございました。\n\n※ これはデモシステムからの自動送信メールです。実際の決済は行われていません。`,
    });
  }
}

// シングルトンインスタンス
export const emailService = new EmailService();
