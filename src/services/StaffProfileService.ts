import UserRepository from '../models/UserRepository';
import { User } from '../models/types';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface UpdateStaffProfileDto {
  name?: string;
  nickname?: string;
  phone?: string;
  department?: string;
  position?: string;
  bio?: string;
}

/**
 * 職員プロフィール管理サービス
 */
export class StaffProfileService {
  /**
   * 職員プロフィール取得
   */
  async getProfile(staffId: number): Promise<Omit<User, 'password_hash'> | null> {
    const user = await UserRepository.findById(staffId);
    if (!user) {
      return null;
    }

    const { password_hash, ...profile } = user;
    return profile;
  }

  /**
   * 職員プロフィール更新
   */
  async updateProfile(
    staffId: number,
    data: UpdateStaffProfileDto
  ): Promise<Omit<User, 'password_hash'>> {
    const user = await UserRepository.findById(staffId);
    if (!user) {
      throw new Error('Staff member not found');
    }

    // 職員または管理者のみ更新可能
    if (user.role !== 'staff' && user.role !== 'admin') {
      throw new Error('Not a staff member');
    }

    // プロフィール更新
    await UserRepository.update(staffId, data);

    // 変更履歴を記録
    await this.recordProfileChange(staffId, data);

    const updatedUser = await UserRepository.findById(staffId);
    if (!updatedUser) {
      throw new Error('Failed to update profile');
    }

    const { password_hash, ...profile } = updatedUser;
    return profile;
  }

  /**
   * プロフィール画像更新
   */
  async updateProfileImage(staffId: number, imagePath: string): Promise<Omit<User, 'password_hash'>> {
    const user = await UserRepository.findById(staffId);
    if (!user) {
      throw new Error('Staff member not found');
    }

    // 既存の画像を削除
    if (user.profile_image_path) {
      await this.deleteImageFile(user.profile_image_path);
    }

    // 新しい画像パスを保存
    await UserRepository.update(staffId, { profile_image_path: imagePath });

    const updatedUser = await UserRepository.findById(staffId);
    if (!updatedUser) {
      throw new Error('Failed to update profile image');
    }

    const { password_hash, ...profile } = updatedUser;
    return profile;
  }

  /**
   * プロフィール画像削除
   */
  async deleteProfileImage(staffId: number): Promise<Omit<User, 'password_hash'>> {
    const user = await UserRepository.findById(staffId);
    if (!user) {
      throw new Error('Staff member not found');
    }

    if (!user.profile_image_path) {
      throw new Error('No profile image to delete');
    }

    // 画像ファイルを削除
    await this.deleteImageFile(user.profile_image_path);

    // DBから画像パスを削除
    await UserRepository.update(staffId, { profile_image_path: null });

    const updatedUser = await UserRepository.findById(staffId);
    if (!updatedUser) {
      throw new Error('Failed to delete profile image');
    }

    const { password_hash, ...profile } = updatedUser;
    return profile;
  }

  /**
   * ニックネーム更新
   */
  async updateNickname(staffId: number, nickname: string): Promise<Omit<User, 'password_hash'>> {
    if (!nickname || nickname.trim().length === 0) {
      throw new Error('Nickname cannot be empty');
    }

    if (nickname.length > 100) {
      throw new Error('Nickname is too long (max 100 characters)');
    }

    await UserRepository.update(staffId, { nickname: nickname.trim() });

    const updatedUser = await UserRepository.findById(staffId);
    if (!updatedUser) {
      throw new Error('Staff member not found');
    }

    const { password_hash, ...profile } = updatedUser;
    return profile;
  }

  /**
   * プロフィール変更履歴を記録
   */
  private async recordProfileChange(staffId: number, changes: UpdateStaffProfileDto): Promise<void> {
    const db = await import('../config/database');
    const pool = db.pool;

    const changeDescription = Object.entries(changes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    await pool.query(
      `INSERT INTO user_profile_changes (user_id, changed_fields, old_values, new_values, change_description)
       VALUES (?, ?, ?, ?, ?)`,
      [staffId, JSON.stringify(Object.keys(changes)), '{}', JSON.stringify(changes), changeDescription]
    );
  }

  /**
   * 画像ファイル削除
   */
  private async deleteImageFile(imagePath: string): Promise<void> {
    try {
      const fullPath = path.join(__dirname, '../../', imagePath);
      await fs.unlink(fullPath);
    } catch (error) {
      // ファイルが存在しない場合はエラーを無視
      console.error('Failed to delete image file:', error);
    }
  }
}

export default new StaffProfileService();
