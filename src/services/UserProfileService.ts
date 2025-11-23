import UserRepository from '../models/UserRepository';
import { User } from '../models/types';
import * as fs from 'fs';
import * as path from 'path';

export interface UpdateProfileDto {
  name?: string;
  nickname?: string;
  organization_name?: string;
  phone?: string;
  address?: string;
  bio?: string;
}

export class UserProfileService {
  /**
   * ユーザープロフィールを取得
   */
  async getProfile(userId: number): Promise<Omit<User, 'password_hash'> | null> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      return null;
    }

    const { password_hash, ...profile } = user;
    return profile;
  }

  /**
   * プロフィール情報を更新
   */
  async updateProfile(userId: number, data: UpdateProfileDto): Promise<Omit<User, 'password_hash'>> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    // 変更履歴を記録（オプション）
    await this.recordProfileChange(userId, data);

    // プロフィールを更新
    const updatedUser = await UserRepository.update(userId, data);

    const { password_hash, ...profile } = updatedUser;
    return profile;
  }

  /**
   * プロフィール画像を更新
   */
  async updateProfileImage(userId: number, imagePath: string): Promise<Omit<User, 'password_hash'>> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    // 古い画像を削除
    if (user.profile_image_path) {
      await this.deleteImageFile(user.profile_image_path);
    }

    // 新しい画像パスを保存
    const updatedUser = await UserRepository.update(userId, { profile_image_path: imagePath });

    const { password_hash, ...profile } = updatedUser;
    return profile;
  }

  /**
   * プロフィール画像を削除
   */
  async deleteProfileImage(userId: number): Promise<Omit<User, 'password_hash'>> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    // 画像ファイルを削除
    if (user.profile_image_path) {
      await this.deleteImageFile(user.profile_image_path);
    }

    // データベースから画像パスを削除
    const updatedUser = await UserRepository.update(userId, { profile_image_path: null });

    const { password_hash, ...profile } = updatedUser;
    return profile;
  }

  /**
   * ニックネームを更新
   */
  async updateNickname(userId: number, nickname: string): Promise<Omit<User, 'password_hash'>> {
    // ニックネームの重複チェック（オプション）
    // const existing = await this.checkNicknameDuplicate(nickname, userId);
    // if (existing) {
    //   throw new Error('このニックネームは既に使用されています');
    // }

    const updatedUser = await UserRepository.update(userId, { nickname });

    const { password_hash, ...profile } = updatedUser;
    return profile;
  }

  /**
   * ユーザーを退会（論理削除）
   */
  async deleteAccount(userId: number): Promise<void> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    // アクティブな予約がある場合はエラー
    const hasActiveReservations = await this.checkActiveReservations(userId);
    if (hasActiveReservations) {
      throw new Error('アクティブな予約があるため退会できません。先に予約をキャンセルしてください。');
    }

    // プロフィール画像を削除
    if (user.profile_image_path) {
      await this.deleteImageFile(user.profile_image_path);
    }

    // 論理削除
    await UserRepository.update(userId, {
      is_active: false,
      deleted_at: new Date(),
      email: `deleted_${userId}_${user.email}`, // メールアドレスを変更して再登録を可能にする
    });
  }

  /**
   * 最終ログイン時刻を更新
   */
  async updateLastLogin(userId: number): Promise<void> {
    await UserRepository.update(userId, {
      last_login_at: new Date(),
    });
  }

  /**
   * プロフィール変更履歴を記録
   */
  private async recordProfileChange(userId: number, changes: UpdateProfileDto): Promise<void> {
    const pool = (await import('../config/database')).default;
    const user = await UserRepository.findById(userId);

    for (const [field, newValue] of Object.entries(changes)) {
      if (newValue !== undefined) {
        const oldValue = (user as any)[field];
        if (oldValue !== newValue) {
          await pool.query(
            `INSERT INTO user_profile_changes (user_id, field_name, old_value, new_value)
             VALUES (?, ?, ?, ?)`,
            [userId, field, oldValue ? String(oldValue) : null, String(newValue)]
          );
        }
      }
    }
  }

  /**
   * アクティブな予約があるかチェック
   */
  private async checkActiveReservations(userId: number): Promise<boolean> {
    const pool = (await import('../config/database')).default;
    const [rows] = await pool.query<any[]>(
      `SELECT COUNT(*) as count FROM applications
       WHERE user_id = ? AND cancel_status = 'none' AND payment_status != 'refunded'`,
      [userId]
    );
    return Number(rows[0]?.count || 0) > 0;
  }

  /**
   * 画像ファイルを削除
   */
  private async deleteImageFile(imagePath: string): Promise<void> {
    try {
      const fullPath = path.join(process.cwd(), imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (error) {
      console.error('画像ファイルの削除に失敗:', error);
      // エラーが発生しても続行（ファイルが既に削除されている可能性がある）
    }
  }
}

export default new UserProfileService();
