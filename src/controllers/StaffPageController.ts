import { Request, Response, NextFunction } from 'express';
import ejs from 'ejs';
import path from 'path';

/**
 * 職員ページコントローラー
 */
export class StaffPageController {
  /**
   * レイアウトをレンダリング
   */
  private static renderWithLayout(
    viewPath: string,
    data: any,
    req: Request,
    res: Response
  ): void {
    const layoutPath = path.join(__dirname, '../views/staff/layout.ejs');
    const viewFullPath = path.join(__dirname, '../views/staff/', viewPath);

    ejs.renderFile(viewFullPath, data, (err, bodyHtml) => {
      if (err) {
        console.error('Error rendering view:', err);
        res.status(500).send('Error rendering page');
        return;
      }

      const layoutData = {
        ...data,
        body: bodyHtml,
        user: req.user,
        currentPath: req.path,
      };

      ejs.renderFile(layoutPath, layoutData, (err, html) => {
        if (err) {
          console.error('Error rendering layout:', err);
          res.status(500).send('Error rendering page');
          return;
        }

        res.send(html);
      });
    });
  }

  /**
   * ダッシュボード
   */
  static async dashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('dashboard.ejs', {
        title: 'ダッシュボード',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ログインページ
   */
  static login(req: Request, res: Response): void {
    res.render('staff/login', {
      title: '職員ログイン',
    });
  }

  /**
   * プロフィールページ
   */
  static async profile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('profile.ejs', {
        title: 'プロフィール',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 予約管理ページ
   */
  static async reservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('reservations.ejs', {
        title: '予約管理',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 利用記録管理ページ
   */
  static async usages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('usages.ejs', {
        title: '利用記録管理',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 利用者管理ページ
   */
  static async users(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('users.ejs', {
        title: '利用者管理',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 部屋管理ページ
   */
  static async rooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('rooms.ejs', {
        title: '部屋管理',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 設備管理ページ
   */
  static async equipment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('equipment.ejs', {
        title: '設備管理',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 休館日管理ページ
   */
  static async closedDates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('closed-dates.ejs', {
        title: '休館日管理',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * お知らせ管理ページ
   */
  static async announcements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('announcements.ejs', {
        title: 'お知らせ管理',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * メッセージ管理ページ
   */
  static async messages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('messages.ejs', {
        title: 'メッセージ管理',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 物販管理ページ
   */
  static async products(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('products.ejs', {
        title: '物販管理',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 代行予約ページ
   */
  static async proxyReservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('proxy-reservations.ejs', {
        title: '代行予約',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * レポートページ
   */
  static async reports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.renderWithLayout('reports.ejs', {
        title: 'レポート',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 職員管理ページ（管理者のみ）
   */
  static async staffManagement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).send('管理者権限が必要です');
        return;
      }

      this.renderWithLayout('staff-management.ejs', {
        title: '職員管理',
      }, req, res);
    } catch (error) {
      next(error);
    }
  }
}
