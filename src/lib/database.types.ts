export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      advance_compensations: {
        Row: {
          advance_id: string
          allocation_id: string
          amount: number
          id: string
        }
        Insert: {
          advance_id: string
          allocation_id: string
          amount: number
          id?: string
        }
        Update: {
          advance_id?: string
          allocation_id?: string
          amount?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_compensations_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "partner_advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_compensations_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "partner_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          actor_id: string | null
          entity: string
          id: number
          new_record: Json | null
          occurred_at: string
          old_record: Json | null
          operation: string
          record_id: string
        }
        Insert: {
          actor_id?: string | null
          entity: string
          id?: never
          new_record?: Json | null
          occurred_at?: string
          old_record?: Json | null
          operation: string
          record_id: string
        }
        Update: {
          actor_id?: string | null
          entity?: string
          id?: never
          new_record?: Json | null
          occurred_at?: string
          old_record?: Json | null
          operation?: string
          record_id?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          business_name: string
          critical_stock_grams: number
          currency: string
          default_deposit_percent: number
          energy_kwh_cost: number | null
          labor_hour_cost: number | null
          low_stock_grams: number
          reference_filament_kg_cost: number
          singleton: boolean
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          business_name?: string
          critical_stock_grams?: number
          currency?: string
          default_deposit_percent?: number
          energy_kwh_cost?: number | null
          labor_hour_cost?: number | null
          low_stock_grams?: number
          reference_filament_kg_cost?: number
          singleton?: boolean
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          business_name?: string
          critical_stock_grams?: number
          currency?: string
          default_deposit_percent?: number
          energy_kwh_cost?: number | null
          labor_hour_cost?: number | null
          low_stock_grams?: number
          reference_filament_kg_cost?: number
          singleton?: boolean
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      cash_entries: {
        Row: {
          amount: number
          authorization_reason: string
          category: string
          created_at: string
          created_by: string
          debt_id: string | null
          description: string
          id: string
          maintenance_id: string | null
          method: string
          occurred_on: string
          order_id: string | null
          partner_id: string | null
          profit_effect: number
          purchase_id: string | null
          reverses_id: string | null
        }
        Insert: {
          amount: number
          authorization_reason?: string
          category: string
          created_at?: string
          created_by: string
          debt_id?: string | null
          description: string
          id?: string
          maintenance_id?: string | null
          method: string
          occurred_on: string
          order_id?: string | null
          partner_id?: string | null
          profit_effect?: number
          purchase_id?: string | null
          reverses_id?: string | null
        }
        Update: {
          amount?: number
          authorization_reason?: string
          category?: string
          created_at?: string
          created_by?: string
          debt_id?: string | null
          description?: string
          id?: string
          maintenance_id?: string | null
          method?: string
          occurred_on?: string
          order_id?: string | null
          partner_id?: string | null
          profit_effect?: number
          purchase_id?: string | null
          reverses_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_entries_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "maintenance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: true
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          address: string
          city: string
          created_at: string
          id: string
          name: string
          notes: string
          phone: string
          version: number
          whatsapp: string
        }
        Insert: {
          active?: boolean
          address?: string
          city?: string
          created_at?: string
          id?: string
          name: string
          notes?: string
          phone?: string
          version?: number
          whatsapp?: string
        }
        Update: {
          active?: boolean
          address?: string
          city?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string
          phone?: string
          version?: number
          whatsapp?: string
        }
        Relationships: []
      }
      debt_installments: {
        Row: {
          debt_id: string
          due_on: string
          id: string
          interest_due: number
          number: number
          principal_due: number
          superseded_at: string | null
        }
        Insert: {
          debt_id: string
          due_on: string
          id?: string
          interest_due: number
          number: number
          principal_due: number
          superseded_at?: string | null
        }
        Update: {
          debt_id?: string
          due_on?: string
          id?: string
          interest_due?: number
          number?: number
          principal_due?: number
          superseded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_installments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          created_at: string
          created_by: string
          debt_id: string
          id: string
          installment_id: string | null
          interest_paid: number
          paid_on: string
          principal_paid: number
        }
        Insert: {
          created_at?: string
          created_by: string
          debt_id: string
          id?: string
          installment_id?: string | null
          interest_paid: number
          paid_on: string
          principal_paid: number
        }
        Update: {
          created_at?: string
          created_by?: string
          debt_id?: string
          id?: string
          installment_id?: string | null
          interest_paid?: number
          paid_on?: string
          principal_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "debt_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string
          created_by: string
          description: string
          financing: string
          id: string
          installment_count: number
          monthly_payment: number
          next_due: string
          notes: string
          principal: number
          purchase_id: string | null
          supplier_id: string | null
          version: number
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          financing?: string
          id?: string
          installment_count: number
          monthly_payment: number
          next_due: string
          notes?: string
          principal: number
          purchase_id?: string | null
          supplier_id?: string | null
          version?: number
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          financing?: string
          id?: string
          installment_count?: number
          monthly_payment?: number
          next_due?: string
          notes?: string
          principal?: number
          purchase_id?: string | null
          supplier_id?: string | null
          version?: number
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lots: {
        Row: {
          cost_per_gram: number | null
          created_at: string
          id: string
          initial_grams: number
          material_id: string
          on_hand_grams: number
          purchase_cost: number
          purchased_on: string
          state: string
          supplier_id: string | null
          version: number
        }
        Insert: {
          cost_per_gram?: number | null
          created_at?: string
          id?: string
          initial_grams: number
          material_id: string
          on_hand_grams: number
          purchase_cost: number
          purchased_on: string
          state?: string
          supplier_id?: string | null
          version?: number
        }
        Update: {
          cost_per_gram?: number | null
          created_at?: string
          id?: string
          initial_grams?: number
          material_id?: string
          on_hand_grams?: number
          purchase_cost?: number
          purchased_on?: string
          state?: string
          supplier_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string
          delta_grams: number
          expense_amount: number
          experiment_id: string | null
          id: string
          kind: string
          lot_id: string
          order_id: string | null
          production_id: string | null
          reason: string
          reserved_delta: number
          reverses_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          delta_grams: number
          expense_amount?: number
          experiment_id?: string | null
          id?: string
          kind: string
          lot_id: string
          order_id?: string | null
          production_id?: string | null
          reason: string
          reserved_delta?: number
          reverses_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          delta_grams?: number
          expense_amount?: number
          experiment_id?: string | null
          id?: string
          kind?: string
          lot_id?: string
          order_id?: string | null
          production_id?: string | null
          reason?: string
          reserved_delta?: number
          reverses_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "print_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "production_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: true
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          cost: number
          created_at: string
          created_by: string
          description: string
          id: string
          next_due: string | null
          notes: string
          performed_on: string
          printer_id: string
        }
        Insert: {
          cost: number
          created_at?: string
          created_by: string
          description: string
          id?: string
          next_due?: string | null
          notes?: string
          performed_on: string
          printer_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          next_due?: string | null
          notes?: string
          performed_on?: string
          printer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_reservations: {
        Row: {
          grams: number
          lot_id: string
          order_id: string
        }
        Insert: {
          grams: number
          lot_id: string
          order_id: string
        }
        Update: {
          grams?: number
          lot_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_reservations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          brand: string
          color: string
          color_hex: string | null
          created_at: string
          id: string
          kind: string
        }
        Insert: {
          brand: string
          color: string
          color_hex?: string | null
          created_at?: string
          id?: string
          kind: string
        }
        Update: {
          brand?: string
          color?: string
          color_hex?: string | null
          created_at?: string
          id?: string
          kind?: string
        }
        Relationships: []
      }
      opening_balances: {
        Row: {
          cash_amount: number
          effective_on: string
          expense: number
          income: number
          notes: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          cash_amount?: number
          effective_on: string
          expense?: number
          income?: number
          notes?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          cash_amount?: number
          effective_on?: string
          expense?: number
          income?: number
          notes?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      order_deliveries: {
        Row: {
          created_at: string
          created_by: string
          delivered_on: string
          id: string
          line_id: string
          notes: string
          quantity: number
        }
        Insert: {
          created_at?: string
          created_by: string
          delivered_on: string
          id?: string
          line_id: string
          notes?: string
          quantity: number
        }
        Update: {
          created_at?: string
          created_by?: string
          delivered_on?: string
          id?: string
          line_id?: string
          notes?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_deliveries_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      order_files: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          object_path: string
          order_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          object_path: string
          order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          object_path?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_line_payments: {
        Row: {
          amount: number
          cash_entry_id: string
          created_at: string
          id: string
          line_id: string
        }
        Insert: {
          amount: number
          cash_entry_id: string
          created_at?: string
          id?: string
          line_id: string
        }
        Update: {
          amount?: number
          cash_entry_id?: string
          created_at?: string
          id?: string
          line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_line_payments_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_payments_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          cost_snapshot: Json
          delivered_at: string | null
          delivered_quantity: number
          description: string
          estimated_hours: number
          id: string
          material_snapshot: Json
          order_id: string
          position: number
          printer_id: string
          product_id: string | null
          quantity: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          cost_snapshot: Json
          delivered_at?: string | null
          delivered_quantity?: number
          description: string
          estimated_hours: number
          id?: string
          material_snapshot: Json
          order_id: string
          position?: number
          printer_id: string
          product_id?: string | null
          quantity: number
          unit_cost: number
          unit_price: number
        }
        Update: {
          cost_snapshot?: Json
          delivered_at?: string | null
          delivered_quantity?: number
          description?: string
          estimated_hours?: number
          id?: string
          material_snapshot?: Json
          order_id?: string
          position?: number
          printer_id?: string
          product_id?: string | null
          quantity?: number
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string
          customer_id: string
          deleted_at: string | null
          delivered_at: string | null
          deposit_percent: number
          description: string
          estimated_cost: number
          id: string
          model_url: string
          notes: string
          number: number
          price_total: number
          priority: number
          promised_at: string
          queue_position: number
          quote_id: string | null
          reference_url: string
          status: string
          version: number
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          deleted_at?: string | null
          delivered_at?: string | null
          deposit_percent: number
          description: string
          estimated_cost: number
          id?: string
          model_url?: string
          notes?: string
          number?: never
          price_total: number
          priority?: number
          promised_at: string
          queue_position?: number
          quote_id?: string | null
          reference_url?: string
          status?: string
          version?: number
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          deleted_at?: string | null
          delivered_at?: string | null
          deposit_percent?: number
          description?: string
          estimated_cost?: number
          id?: string
          model_url?: string
          notes?: string
          number?: never
          price_total?: number
          priority?: number
          promised_at?: string
          queue_position?: number
          quote_id?: string | null
          reference_url?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_advances: {
        Row: {
          amount: number
          cash_entry_id: string
          created_at: string
          id: string
          partner_id: string
        }
        Insert: {
          amount: number
          cash_entry_id: string
          created_at?: string
          id?: string
          partner_id: string
        }
        Update: {
          amount?: number
          cash_entry_id?: string
          created_at?: string
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_advances_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: true
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_advances_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_allocations: {
        Row: {
          amount: number
          id: string
          partner_id: string
          settlement_id: string
        }
        Insert: {
          amount: number
          id?: string
          partner_id: string
          settlement_id: string
        }
        Update: {
          amount?: number
          id?: string
          partner_id?: string
          settlement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_allocations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_allocations_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_withdrawals: {
        Row: {
          amount: number
          authorization_reason: string
          authorized_overdraft: boolean
          cash_entry_id: string
          created_at: string
          id: string
          partner_id: string
        }
        Insert: {
          amount: number
          authorization_reason?: string
          authorized_overdraft?: boolean
          cash_entry_id: string
          created_at?: string
          id?: string
          partner_id: string
        }
        Update: {
          amount?: number
          authorization_reason?: string
          authorized_overdraft?: boolean
          cash_entry_id?: string
          created_at?: string
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_withdrawals_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: true
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_withdrawals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          share_basis_points: number
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          share_basis_points?: number
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          share_basis_points?: number
        }
        Relationships: []
      }
      print_experiments: {
        Row: {
          actual_hours: number
          created_at: string
          created_by: string
          description: string
          details: Json
          id: string
          kind: string
          material_cost: number
          printer_id: string | null
          reversed_at: string | null
        }
        Insert: {
          actual_hours?: number
          created_at?: string
          created_by: string
          description: string
          details: Json
          id?: string
          kind: string
          material_cost: number
          printer_id?: string | null
          reversed_at?: string | null
        }
        Update: {
          actual_hours?: number
          created_at?: string
          created_by?: string
          description?: string
          details?: Json
          id?: string
          kind?: string
          material_cost?: number
          printer_id?: string | null
          reversed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_experiments_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          accumulated_hours: number
          acquisition_cost: number | null
          baseline_hours: number
          created_at: string
          energy_rate: number | null
          id: string
          model: string
          name: string
          notes: string
          power_kw: number | null
          purchased_on: string | null
          status: string
          useful_hours: number | null
          version: number
        }
        Insert: {
          accumulated_hours?: number
          acquisition_cost?: number | null
          baseline_hours?: number
          created_at?: string
          energy_rate?: number | null
          id?: string
          model: string
          name: string
          notes?: string
          power_kw?: number | null
          purchased_on?: string | null
          status?: string
          useful_hours?: number | null
          version?: number
        }
        Update: {
          accumulated_hours?: number
          acquisition_cost?: number | null
          baseline_hours?: number
          created_at?: string
          energy_rate?: number | null
          id?: string
          model?: string
          name?: string
          notes?: string
          power_kw?: number | null
          purchased_on?: string | null
          status?: string
          useful_hours?: number | null
          version?: number
        }
        Relationships: []
      }
      production_runs: {
        Row: {
          actual_hours: number
          cost_total: number
          created_at: string
          created_by: string
          depreciation_cost: number
          details: Json
          energy_cost: number
          good_units: number
          id: string
          material_cost: number
          notes: string
          order_line_id: string
          other_cost: number
          printer_id: string
          reversed_at: string | null
        }
        Insert: {
          actual_hours: number
          cost_total: number
          created_at?: string
          created_by: string
          depreciation_cost: number
          details: Json
          energy_cost: number
          good_units: number
          id?: string
          material_cost: number
          notes?: string
          order_line_id: string
          other_cost: number
          printer_id: string
          reversed_at?: string | null
        }
        Update: {
          actual_hours?: number
          cost_total?: number
          created_at?: string
          created_by?: string
          depreciation_cost?: number
          details?: Json
          energy_cost?: number
          good_units?: number
          id?: string
          material_cost?: number
          notes?: string
          order_line_id?: string
          other_cost?: number
          printer_id?: string
          reversed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_runs_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: string
          model_url: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          model_url?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          model_url?: string
          name?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string
          expense_amount: number
          financing: string
          id: string
          lot_id: string | null
          paid_initial: number
          printer_id: string | null
          purchased_on: string
          supplier_id: string | null
          total: number
          version: number
          voided_at: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          description: string
          expense_amount?: number
          financing?: string
          id?: string
          lot_id?: string | null
          paid_initial: number
          printer_id?: string | null
          purchased_on: string
          supplier_id?: string | null
          total: number
          version?: number
          voided_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          expense_amount?: number
          financing?: string
          id?: string
          lot_id?: string | null
          paid_initial?: number
          printer_id?: string | null
          purchased_on?: string
          supplier_id?: string | null
          total?: number
          version?: number
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: true
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          cost_snapshot: Json
          description: string
          estimated_hours: number
          id: string
          material_snapshot: Json
          position: number
          printer_id: string
          product_id: string | null
          quantity: number
          quote_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          cost_snapshot: Json
          description: string
          estimated_hours: number
          id?: string
          material_snapshot: Json
          position?: number
          printer_id: string
          product_id?: string | null
          quantity: number
          quote_id: string
          unit_cost: number
          unit_price: number
        }
        Update: {
          cost_snapshot?: Json
          description?: string
          estimated_hours?: number
          id?: string
          material_snapshot?: Json
          position?: number
          printer_id?: string
          product_id?: string | null
          quantity?: number
          quote_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          cost_total: number
          created_at: string
          created_by: string
          customer_id: string
          deposit_percent: number
          description: string
          id: string
          notes: string
          number: number
          price_total: number
          status: string
          version: number
        }
        Insert: {
          cost_total: number
          created_at?: string
          created_by: string
          customer_id: string
          deposit_percent: number
          description: string
          id?: string
          notes?: string
          number?: never
          price_total: number
          status?: string
          version?: number
        }
        Update: {
          cost_total?: number
          created_at?: string
          created_by?: string
          customer_id?: string
          deposit_percent?: number
          description?: string
          id?: string
          notes?: string
          number?: never
          price_total?: number
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_requests: {
        Row: {
          created_at: string
          display_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          user_id?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          created_at: string
          created_by: string
          distributed: number
          id: string
          notes: string
          period_end: string
          period_start: string
          profit_recognized: number
          reserve_release: number
          reserved: number
        }
        Insert: {
          created_at?: string
          created_by: string
          distributed: number
          id?: string
          notes?: string
          period_end: string
          period_start: string
          profit_recognized: number
          reserve_release?: number
          reserved: number
        }
        Update: {
          created_at?: string
          created_by?: string
          distributed?: number
          id?: string
          notes?: string
          period_end?: string
          period_start?: string
          profit_recognized?: number
          reserve_release?: number
          reserved?: number
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string
          phone?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string
          phone?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          partner_id: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          partner_id: string
          role?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          partner_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_registration: {
        Args: { p_partner_code: string; p_user_id: string }
        Returns: {
          active: boolean
          created_at: string
          display_name: string
          partner_id: string
          role: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      business_operate: {
        Args: { p_action: string; p_data: Json; p_request_id: string }
        Returns: Json
      }
      business_read: {
        Args: {
          p_from?: string
          p_id?: string
          p_page?: number
          p_search?: string
          p_section: string
          p_to?: string
        }
        Returns: Json
      }
      business_report: {
        Args: { p_from: string; p_kind: string; p_page?: number; p_to: string }
        Returns: Json
      }
      get_pending_registrations: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          display_name: string
          email: string
          email_confirmed: boolean
          user_id: string
        }[]
      }
      preview_order_priority: {
        Args: { p_order_id: string; p_position: number; p_priority: number }
        Returns: Json
      }
      preview_production_cost: { Args: { p_data: Json }; Returns: Json }
      update_business_settings: {
        Args: {
          p_changes: Json
          p_expected_version: number
          p_request_id: string
        }
        Returns: {
          business_name: string
          critical_stock_grams: number
          currency: string
          default_deposit_percent: number
          energy_kwh_cost: number | null
          labor_hour_cost: number | null
          low_stock_grams: number
          reference_filament_kg_cost: number
          singleton: boolean
          timezone: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "business_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
