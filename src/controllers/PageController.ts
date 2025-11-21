import { Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler';
import UserProfileService from '../services/UserProfileService';
import RoomRepository from '../models/RoomRepository';
import ApplicationRepository from '../models/ApplicationRepository';

/**
 * ページレンダリング用コントローラー
 */
export class PageController {
  /**
   * トップページ
   */
  static async home(req: Request, res: Response): Promise<void> {
    const rooms = await RoomRepository.findAllActive();
    res.render('public/index', {
      title: '施設予約システム',
      user: req.user,
      rooms: rooms.slice(0, 6),
    });
  }

  /**
   * 会員登録ページ
   */
  static register(req: Request, res: Response): void {
    res.render('auth/register', {
      title: '新規会員登録',
      user: req.user,
    });
  }

  /**
   * ログインページ
   */
  static login(req: Request, res: Response): void {
    res.render('auth/login', {
      title: 'ログイン',
      user: req.user,
    });
  }

  /**
   * マイページ
   */
  static async myPage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.redirect('/login');
        return;
      }

      const profile = await UserProfileService.getProfile(req.user.userId);
      if (!profile) {
        next(createError('ユーザーが見つかりません', 404));
        return;
      }

      // 直近の予約を取得
      const pool = (await import('../config/database')).default;
      const [upcomingReservations] = await pool.query(
        `SELECT a.*,
                (SELECT MIN(date) FROM usages WHERE application_id = a.id) as first_date,
                (SELECT MAX(date) FROM usages WHERE application_id = a.id) as last_date
         FROM applications a
         WHERE a.user_id = ? AND a.cancel_status = 'none'
           AND EXISTS (SELECT 1 FROM usages WHERE application_id = a.id AND date >= CURDATE())
         ORDER BY (SELECT MIN(date) FROM usages WHERE application_id = a.id) ASC
         LIMIT 3`,
        [req.user.userId]
      );

      res.render('user/mypage', {
        title: 'マイページ',
        user: req.user,
        profile,
        upcomingReservations,
      });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * プロフィール編集ページ
   */
  static async editProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.redirect('/login');
        return;
      }

      const profile = await UserProfileService.getProfile(req.user.userId);
      if (!profile) {
        next(createError('ユーザーが見つかりません', 404));
        return;
      }

      res.render('user/edit-profile', {
        title: 'プロフィール編集',
        user: req.user,
        profile,
      });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * 予約一覧ページ
   */
  static async myReservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.redirect('/login');
        return;
      }

      const pool = (await import('../config/database')).default;
      const [reservations] = await pool.query(
        `SELECT a.*,
                (SELECT COUNT(*) FROM usages WHERE application_id = a.id) as usage_count,
                (SELECT MIN(date) FROM usages WHERE application_id = a.id) as first_date,
                (SELECT MAX(date) FROM usages WHERE application_id = a.id) as last_date,
                (SELECT GROUP_CONCAT(DISTINCT r.name SEPARATOR '、')
                 FROM usages u
                 INNER JOIN rooms r ON u.room_id = r.id
                 WHERE u.application_id = a.id) as room_names
         FROM applications a
         WHERE a.user_id = ?
         ORDER BY a.created_at DESC`,
        [req.user.userId]
      );

      res.render('user/reservations', {
        title: '予約一覧',
        user: req.user,
        reservations,
      });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * 予約詳細ページ
   */
  static async reservationDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.redirect('/login');
        return;
      }

      const { id } = req.params;
      const result = await ApplicationRepository.findByIdWithDetails(parseInt(id, 10));

      if (!result) {
        next(createError('予約が見つかりません', 404));
        return;
      }

      if (result.application.user_id !== req.user.userId) {
        next(createError('アクセス権限がありません', 403));
        return;
      }

      // 部屋情報を取得
      const usagesWithDetails = await Promise.all(
        result.usages.map(async (usage) => {
          const room = await RoomRepository.findById(usage.room_id);
          return { ...usage, room };
        })
      );

      res.render('user/reservation-detail', {
        title: '予約詳細',
        user: req.user,
        application: result.application,
        usages: usagesWithDetails,
      });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * 空き状況確認ページ
   */
  static async availability(req: Request, res: Response): Promise<void> {
    const rooms = await RoomRepository.findAllActive();
    res.render('public/availability', {
      title: '空き状況確認',
      user: req.user,
      rooms,
    });
  }

  /**
   * 部屋一覧ページ
   */
  static async rooms(req: Request, res: Response): Promise<void> {
    const rooms = await RoomRepository.findAllActive();
    res.render('public/rooms', {
      title: '部屋一覧',
      user: req.user,
      rooms,
    });
  }

  /**
   * 施設詳細ページ
   */
  static async roomDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const room = await RoomRepository.findById(parseInt(id, 10));

      if (!room) {
        next(createError('施設が見つかりません', 404));
        return;
      }

      res.render('public/room-detail', {
        title: room.name,
        user: req.user,
        room,
      });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * 利用規約ページ
   */
  static terms(req: Request, res: Response): void {
    res.render('public/terms', {
      title: '利用規約',
      user: req.user,
    });
  }

  /**
   * プライバシーポリシーページ
   */
  static privacy(req: Request, res: Response): void {
    res.render('public/privacy', {
      title: 'プライバシーポリシー',
      user: req.user,
    });
  }

  /**
   * お問い合わせページ
   */
  static contact(req: Request, res: Response): void {
    res.render('public/contact', {
      title: 'お問い合わせ',
      user: req.user,
    });
  }

  /**
   * 予約確認ページ
   */
  static async bookingConfirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.redirect('/login');
        return;
      }

      const { roomId, date, slots } = req.query;

      if (!roomId || !date || !slots) {
        next(createError('予約情報が不足しています', 400));
        return;
      }

      const room = await RoomRepository.findById(parseInt(roomId as string, 10));

      if (!room) {
        next(createError('施設が見つかりません', 404));
        return;
      }

      // プロフィール情報を取得
      const profile = await UserProfileService.getProfile(req.user.userId);

      // スロット情報を解析
      const selectedSlots = (slots as string).split(',');

      res.render('public/booking-confirm', {
        title: '予約確認',
        user: profile || req.user, // プロフィール情報があればそれを使用
        room,
        date,
        selectedSlots,
      });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * 決済情報確認ページ
   */
  static async bookingPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.redirect('/login');
        return;
      }

      res.render('public/booking-payment', {
        title: '決済情報確認',
        user: req.user,
      });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * 予約完了ページ
   */
  static async bookingSuccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.redirect('/login');
        return;
      }

      const { applicationId } = req.query;

      if (!applicationId) {
        next(createError('予約IDが指定されていません', 400));
        return;
      }

      const result = await ApplicationRepository.findByIdWithDetails(
        parseInt(applicationId as string, 10)
      );

      if (!result) {
        next(createError('予約が見つかりません', 404));
        return;
      }

      if (result.application.user_id !== req.user.userId) {
        next(createError('アクセス権限がありません', 403));
        return;
      }

      res.render('public/booking-success', {
        title: '予約完了',
        user: req.user,
        application: result.application,
      });
    } catch (error: any) {
      next(createError(error.message, 500));
    }
  }

  /**
   * パスワードリマインダーページ
   */
  static forgotPassword(req: Request, res: Response): void {
    res.render('auth/forgot-password', {
      title: 'パスワードリマインダー',
      user: req.user,
    });
  }

  /**
   * パスワード変更ページ
   */
  static changePassword(req: Request, res: Response): void {
    if (!req.user) {
      res.redirect('/login');
      return;
    }

    res.render('user/change-password', {
      title: 'パスワード変更',
      user: req.user,
    });
  }

  /**
   * レビュー作成ページ
   */
  static createReview(req: Request, res: Response): void {
    if (!req.user) {
      res.redirect('/login');
      return;
    }

    res.render('user/create-review', {
      title: 'レビューを投稿',
      user: req.user,
    });
  }

  /**
   * レビュー編集ページ
   */
  static editReview(req: Request, res: Response): void {
    if (!req.user) {
      res.redirect('/login');
      return;
    }

    res.render('user/edit-review', {
      title: 'レビューを編集',
      user: req.user,
    });
  }

  /**
   * お気に入り施設一覧ページ
   */
  static favorites(req: Request, res: Response): void {
    if (!req.user) {
      res.redirect('/login');
      return;
    }

    res.render('user/favorites', {
      title: 'お気に入り施設',
      user: req.user,
    });
  }

  /**
   * お知らせ一覧ページ
   */
  static announcements(req: Request, res: Response): void {
    if (!req.user) {
      res.redirect('/login');
      return;
    }

    res.render('user/announcements', {
      title: 'お知らせ',
      user: req.user,
    });
  }

  /**
   * メッセージ一覧ページ
   */
  static messages(req: Request, res: Response): void {
    if (!req.user) {
      res.redirect('/login');
      return;
    }

    res.render('user/messages', {
      title: 'メッセージ',
      user: req.user,
    });
  }

  /**
   * メッセージ送信ページ
   */
  static composeMessage(req: Request, res: Response): void {
    if (!req.user) {
      res.redirect('/login');
      return;
    }

    res.render('user/compose-message', {
      title: 'メッセージ送信',
      user: req.user,
    });
  }

  /**
   * ログアウト
   */
  static logout(req: Request, res: Response): void {
    // ユーザーが職員または管理者の場合は /staff/login にリダイレクト
    const isStaff = req.user && (req.user.role === 'staff' || req.user.role === 'admin');

    res.clearCookie('token');

    if (isStaff) {
      res.redirect('/staff/login');
    } else {
      res.redirect('/');
    }
  }
}
