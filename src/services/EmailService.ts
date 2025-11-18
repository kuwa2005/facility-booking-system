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
   */
  private initializeTransporter(): void {
    try {
      const emailConfig = {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      };

      // 設定が不完全な場合は開発モードとして動作
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        console.warn(
          'Email configuration is incomplete. Running in development mode.',
        );
        console.warn(
          'To enable email sending, set SMTP_HOST, SMTP_USER, and SMTP_PASS in environment variables.',
        );

        // 開発環境ではetherealmailのテストアカウントを使用
        this.createTestAccount();
        return;
      }

      this.transporter = nodemailer.createTransport(emailConfig);
      this.isConfigured = true;

      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * 開発用テストアカウントを作成
   */
  private async createTestAccount(): Promise<void> {
    try {
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      this.isConfigured = true;
      console.log('Test email account created:');
      console.log('  User:', testAccount.user);
      console.log('  Pass:', testAccount.pass);
    } catch (error) {
      console.error('Failed to create test account:', error);
      this.isConfigured = false;
    }
  }

  /**
   * メールを送信
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    from?: string;
  }): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
    if (!this.isConfigured || !this.transporter) {
      console.error('Email service is not configured');
      return {
        success: false,
        error: 'Email service is not configured',
      };
    }

    try {
      const from =
        options.from || process.env.SMTP_FROM || 'no-reply@facility.local';

      const mailOptions = {
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log('Email sent successfully:', info.messageId);

      // 開発環境の場合、プレビューURLを取得
      const previewUrl = nodemailer.getTestMessageUrl(info);

      if (previewUrl) {
        console.log('Preview URL:', previewUrl);
        return {
          success: true,
          messageId: info.messageId,
          previewUrl: previewUrl as string,
        };
      }

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      console.error('Failed to send email:', error);
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
   * メールサービスの状態を確認
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('Email server connection verified');
      return true;
    } catch (error) {
      console.error('Email server connection failed:', error);
      return false;
    }
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
}

// シングルトンインスタンス
export const emailService = new EmailService();
