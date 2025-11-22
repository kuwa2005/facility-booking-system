import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { Product, Sale } from '../models/types';

export interface CreateProductDto {
  name: string;
  category: string;
  price: number;
  cost?: number;
  stock_quantity?: number;
  description?: string;
  display_order?: number;
}

export interface CreateSaleDto {
  application_id?: number;
  product_id: number;
  quantity: number;
  customer_name?: string;
  notes?: string;
}

/**
 * 物販管理サービス
 */
export class ProductManagementService {
  /**
   * Convert snake_case database columns to camelCase
   */
  private toCamelCaseProduct(product: any): any {
    return {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      cost: product.cost,
      stock: product.stock_quantity,
      stockQuantity: product.stock_quantity,
      isActive: product.is_available,
      isAvailable: product.is_available,
      description: product.description,
      displayOrder: product.display_order,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    };
  }

  /**
   * Convert snake_case sale columns to camelCase
   */
  private toCamelCaseSale(sale: any): any {
    return {
      id: sale.id,
      applicationId: sale.application_id,
      productId: sale.product_id,
      productName: sale.product_name,
      productCategory: sale.product_category,
      quantity: sale.quantity,
      unitPrice: sale.unit_price,
      totalAmount: sale.total_price,
      totalPrice: sale.total_price,
      soldBy: sale.sold_by,
      staffName: sale.staff_name,
      buyerName: sale.customer_name,
      customerName: sale.customer_name,
      notes: sale.notes,
      createdAt: sale.sold_at,
      soldAt: sale.sold_at,
    };
  }

  /**
   * 商品一覧を取得
   */
  async getProducts(includeUnavailable: boolean = false): Promise<Product[]> {
    let query = 'SELECT * FROM products';

    if (!includeUnavailable) {
      query += ' WHERE is_available = TRUE';
    }

    query += ' ORDER BY display_order, name';

    const [rows] = await pool.query<RowDataPacket[]>(query);
    return rows.map(row => this.toCamelCaseProduct(row));
  }

  /**
   * 商品を作成
   */
  async createProduct(staffId: number, data: CreateProductDto): Promise<Product> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO products (name, category, price, cost, stock_quantity, description, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.category,
        data.price,
        data.cost || null,
        data.stock_quantity || null,
        data.description || null,
        data.display_order || 0,
      ]
    );

    const [product] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM products WHERE id = ?',
      [result.insertId]
    );

    await this.logActivity(staffId, 'create', 'product', result.insertId, `Product created: ${data.name}`);

    return this.toCamelCaseProduct(product[0]) as Product;
  }

  /**
   * 商品を更新
   */
  async updateProduct(productId: number, staffId: number, updates: Partial<Product>): Promise<void> {
    const [product] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM products WHERE id = ?',
      [productId]
    );

    if (product.length === 0) {
      throw new Error('Product not found');
    }

    const fields = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map(key => `${key} = ?`)
      .join(', ');

    const values = Object.keys(updates)
      .filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
      .map(key => updates[key as keyof Product]);

    if (fields) {
      await pool.query(
        `UPDATE products SET ${fields} WHERE id = ?`,
        [...values, productId]
      );
    }

    await this.logActivity(staffId, 'update', 'product', productId, `Product updated: ${JSON.stringify(updates)}`);
  }

  /**
   * 商品を削除（論理削除）
   */
  async deleteProduct(productId: number, staffId: number): Promise<void> {
    await pool.query(
      'UPDATE products SET is_available = FALSE WHERE id = ?',
      [productId]
    );

    await this.logActivity(staffId, 'delete', 'product', productId, 'Product disabled');
  }

  /**
   * 販売記録を作成
   */
  async createSale(staffId: number, data: CreateSaleDto): Promise<Sale> {
    // 商品情報を取得
    const [products] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM products WHERE id = ?',
      [data.product_id]
    );

    if (products.length === 0) {
      throw new Error('Product not found');
    }

    const product = products[0] as Product;

    if (!product.is_available) {
      throw new Error('Product is not available for sale');
    }

    // 在庫チェック
    if (product.stock_quantity !== null && product.stock_quantity < data.quantity) {
      throw new Error(`Insufficient stock. Available: ${product.stock_quantity}`);
    }

    const totalPrice = product.price * data.quantity;

    // 販売記録を作成
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO sales (application_id, product_id, quantity, unit_price, total_price, sold_by, customer_name, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.application_id || null,
        data.product_id,
        data.quantity,
        product.price,
        totalPrice,
        staffId,
        data.customer_name || null,
        data.notes || null,
      ]
    );

    // 在庫を減らす
    if (product.stock_quantity !== null) {
      await pool.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [data.quantity, data.product_id]
      );
    }

    // 予約に紐づく場合は予約の物販額を更新
    if (data.application_id) {
      await pool.query(
        'UPDATE applications SET product_sales_amount = product_sales_amount + ? WHERE id = ?',
        [totalPrice, data.application_id]
      );
    }

    const [sale] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM sales WHERE id = ?',
      [result.insertId]
    );

    await this.logActivity(
      staffId,
      'create',
      'sale',
      result.insertId,
      `Sale created: ${product.name} x ${data.quantity} = ¥${totalPrice}`
    );

    return this.toCamelCaseSale(sale[0]) as Sale;
  }

  /**
   * 販売履歴を取得
   */
  async getSales(filters: {
    startDate?: Date;
    endDate?: Date;
    productId?: number;
    applicationId?: number;
  } = {}): Promise<any[]> {
    let query = `
      SELECT
        s.*,
        p.name as product_name,
        p.category as product_category,
        u.name as staff_name
      FROM sales s
      JOIN products p ON s.product_id = p.id
      JOIN users u ON s.sold_by = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters.startDate) {
      query += ' AND s.sold_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND s.sold_at <= ?';
      params.push(filters.endDate);
    }

    if (filters.productId) {
      query += ' AND s.product_id = ?';
      params.push(filters.productId);
    }

    if (filters.applicationId) {
      query += ' AND s.application_id = ?';
      params.push(filters.applicationId);
    }

    query += ' ORDER BY s.sold_at DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows.map(row => this.toCamelCaseSale(row));
  }

  /**
   * 販売統計を取得
   */
  async getSalesStats(startDate?: Date, endDate?: Date): Promise<any> {
    let query = `
      SELECT
        COUNT(*) as total_sales,
        SUM(quantity) as total_quantity,
        SUM(total_price) as total_revenue,
        COUNT(DISTINCT product_id) as unique_products
      FROM sales
      WHERE 1=1
    `;

    const params: any[] = [];

    if (startDate) {
      query += ' AND sold_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND sold_at <= ?';
      params.push(endDate);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows[0] || { total_sales: 0, total_quantity: 0, total_revenue: 0, unique_products: 0 };
  }

  /**
   * アクティビティログを記録
   */
  private async logActivity(
    staffId: number,
    actionType: string,
    targetType: string,
    targetId: number,
    description: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO staff_activity_logs (staff_id, action_type, target_type, target_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [staffId, actionType, targetType, targetId, description]
    );
  }
}

export default new ProductManagementService();
