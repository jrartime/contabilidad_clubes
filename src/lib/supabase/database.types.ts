export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bancos: {
        Row: {
          categoria: string | null
          club_id: number
          concepto_id: number | null
          concepto_txt: string | null
          created_at: string
          debe: number | null
          detalle: string | null
          fecha_operativa: string | null
          fecha_valor: string | null
          haber: number | null
          id_banco: number
          importe: number | null
          orden: number | null
          programa_id: number | null
          programa_txt: string | null
          referencia: string | null
          referencia_1: string | null
          referencia_2: string | null
          saldo: number | null
        }
        Insert: {
          categoria?: string | null
          club_id: number
          concepto_id?: number | null
          concepto_txt?: string | null
          created_at?: string
          debe?: number | null
          detalle?: string | null
          fecha_operativa?: string | null
          fecha_valor?: string | null
          haber?: number | null
          id_banco?: number
          importe?: number | null
          orden?: number | null
          programa_id?: number | null
          programa_txt?: string | null
          referencia?: string | null
          referencia_1?: string | null
          referencia_2?: string | null
          saldo?: number | null
        }
        Update: {
          categoria?: string | null
          club_id?: number
          concepto_id?: number | null
          concepto_txt?: string | null
          created_at?: string
          debe?: number | null
          detalle?: string | null
          fecha_operativa?: string | null
          fecha_valor?: string | null
          haber?: number | null
          id_banco?: number
          importe?: number | null
          orden?: number | null
          programa_id?: number | null
          programa_txt?: string | null
          referencia?: string | null
          referencia_1?: string | null
          referencia_2?: string | null
          saldo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bancos_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "bancos_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id_concepto"]
          },
          {
            foreignKeyName: "bancos_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas"
            referencedColumns: ["id_programa"]
          },
        ]
      }
      categorias: {
        Row: {
          categoria: string
          created_at: string
          id_categoria: number
        }
        Insert: {
          categoria: string
          created_at?: string
          id_categoria?: never
        }
        Update: {
          categoria?: string
          created_at?: string
          id_categoria?: never
        }
        Relationships: []
      }
      checklist_justificacion: {
        Row: {
          club_id: number
          comentario: string | null
          created_at: string
          entregado: boolean
          fecha_entrega: string | null
          id_check: number
          item: string
          requerido: boolean
          subvencion_id: number
        }
        Insert: {
          club_id: number
          comentario?: string | null
          created_at?: string
          entregado?: boolean
          fecha_entrega?: string | null
          id_check?: number
          item: string
          requerido?: boolean
          subvencion_id: number
        }
        Update: {
          club_id?: number
          comentario?: string | null
          created_at?: string
          entregado?: boolean
          fecha_entrega?: string | null
          id_check?: number
          item?: string
          requerido?: boolean
          subvencion_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_justificacion_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "checklist_justificacion_subvencion_id_fkey"
            columns: ["subvencion_id"]
            isOneToOne: false
            referencedRelation: "subvenciones"
            referencedColumns: ["id_subvencion"]
          },
        ]
      }
      club_miembros: {
        Row: {
          club_id: number
          id_club_miembro: number
          rol: string
          user_id: string
        }
        Insert: {
          club_id: number
          id_club_miembro?: number
          rol?: string
          user_id: string
        }
        Update: {
          club_id?: number
          id_club_miembro?: number
          rol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_miembros_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "club_miembros_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      clubes: {
        Row: {
          created_at: string
          direccion: string | null
          email: string | null
          id_club: number
          nif: string | null
          nombre: string
          telefono: string | null
        }
        Insert: {
          created_at?: string
          direccion?: string | null
          email?: string | null
          id_club?: number
          nif?: string | null
          nombre: string
          telefono?: string | null
        }
        Update: {
          created_at?: string
          direccion?: string | null
          email?: string | null
          id_club?: number
          nif?: string | null
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      conceptos: {
        Row: {
          club_id: number
          codigo_interno: string | null
          concepto: string
          created_at: string
          en_listado: boolean
          id_concepto: number
          naturaleza: string
          requisito_descripcion: string
          requisito_entidad_origen: string
          subvencionabilidad: string
          valido_clubes: boolean
          valido_eedd_ctd_discapacidad: boolean
          valido_eventos: boolean
        }
        Insert: {
          club_id: number
          codigo_interno?: string | null
          concepto: string
          created_at?: string
          en_listado?: boolean
          id_concepto?: number
          naturaleza?: string
          requisito_descripcion?: string
          requisito_entidad_origen?: string
          subvencionabilidad?: string
          valido_clubes?: boolean
          valido_eedd_ctd_discapacidad?: boolean
          valido_eventos?: boolean
        }
        Update: {
          club_id?: number
          codigo_interno?: string | null
          concepto?: string
          created_at?: string
          en_listado?: boolean
          id_concepto?: number
          naturaleza?: string
          requisito_descripcion?: string
          requisito_entidad_origen?: string
          subvencionabilidad?: string
          valido_clubes?: boolean
          valido_eedd_ctd_discapacidad?: boolean
          valido_eventos?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
        ]
      }
      conceptos_alias: {
        Row: {
          club_id: number
          concepto_id: number
          concepto_txt: string
          id_alias: number
        }
        Insert: {
          club_id: number
          concepto_id: number
          concepto_txt: string
          id_alias?: number
        }
        Update: {
          club_id?: number
          concepto_id?: number
          concepto_txt?: string
          id_alias?: number
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_alias_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "conceptos_alias_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id_concepto"]
          },
        ]
      }
      contabilidad: {
        Row: {
          bruto: number | null
          bruto_imputado: number | null
          categoria: string | null
          categoria_id: number | null
          club_id: number
          concepto_id: number | null
          coste_empresarial: number | null
          created_at: string
          detalle: string | null
          entidad_id: number | null
          fecha: string | null
          fecha_pago: string | null
          id_contabilidad: number
          importe_imputado: number
          importe_total: number
          numero_factura: string | null
          observaciones: string | null
          personal: string | null
          personal_id: number | null
          programa_id: number | null
          proveedor_id: number | null
          ss: number | null
          ss_imputado: number | null
          tipo_documento: string | null
          tipo_id: number | null
        }
        Insert: {
          bruto?: number | null
          bruto_imputado?: number | null
          categoria?: string | null
          categoria_id?: number | null
          club_id: number
          concepto_id?: number | null
          coste_empresarial?: number | null
          created_at?: string
          detalle?: string | null
          entidad_id?: number | null
          fecha?: string | null
          fecha_pago?: string | null
          id_contabilidad?: number
          importe_imputado?: number
          importe_total?: number
          numero_factura?: string | null
          observaciones?: string | null
          personal?: string | null
          personal_id?: number | null
          programa_id?: number | null
          proveedor_id?: number | null
          ss?: number | null
          ss_imputado?: number | null
          tipo_documento?: string | null
          tipo_id?: number | null
        }
        Update: {
          bruto?: number | null
          bruto_imputado?: number | null
          categoria?: string | null
          categoria_id?: number | null
          club_id?: number
          concepto_id?: number | null
          coste_empresarial?: number | null
          created_at?: string
          detalle?: string | null
          entidad_id?: number | null
          fecha?: string | null
          fecha_pago?: string | null
          id_contabilidad?: number
          importe_imputado?: number
          importe_total?: number
          numero_factura?: string | null
          observaciones?: string | null
          personal?: string | null
          personal_id?: number | null
          programa_id?: number | null
          proveedor_id?: number | null
          ss?: number | null
          ss_imputado?: number | null
          tipo_documento?: string | null
          tipo_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contabilidad_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id_categoria"]
          },
          {
            foreignKeyName: "contabilidad_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "contabilidad_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id_concepto"]
          },
          {
            foreignKeyName: "contabilidad_entidad_id_fkey"
            columns: ["entidad_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id_entidad"]
          },
          {
            foreignKeyName: "contabilidad_personal_id_fkey"
            columns: ["personal_id"]
            isOneToOne: false
            referencedRelation: "personal"
            referencedColumns: ["id_personal"]
          },
          {
            foreignKeyName: "contabilidad_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas"
            referencedColumns: ["id_programa"]
          },
          {
            foreignKeyName: "contabilidad_proveedor_fk"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id_proveedor"]
          },
          {
            foreignKeyName: "contabilidad_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id_proveedor"]
          },
          {
            foreignKeyName: "contabilidad_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos"
            referencedColumns: ["id_tipo"]
          },
        ]
      }
      contabilidad_documentos: {
        Row: {
          bucket: string
          club_id: number
          contabilidad_id: number
          created_at: string
          filename: string
          id_documento: string
          mime: string | null
          path: string
          size: number | null
        }
        Insert: {
          bucket: string
          club_id: number
          contabilidad_id: number
          created_at?: string
          filename: string
          id_documento?: string
          mime?: string | null
          path: string
          size?: number | null
        }
        Update: {
          bucket?: string
          club_id?: number
          contabilidad_id?: number
          created_at?: string
          filename?: string
          id_documento?: string
          mime?: string | null
          path?: string
          size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contabilidad_documentos_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "contabilidad_documentos_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "contabilidad"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "contabilidad_documentos_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "vw_contabilidad_pagos_estado"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "contabilidad_documentos_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "vw_sugerencias_conciliacion_1a1"
            referencedColumns: ["id_contabilidad"]
          },
        ]
      }
      documentos: {
        Row: {
          bucket: string
          club_id: number
          contabilidad_id: number | null
          content_type: string | null
          created_at: string
          created_by: string | null
          fecha: string | null
          filename: string | null
          id: number
          nomina_id: number | null
          path: string
          personal_id: number | null
          programa_id: number | null
          size_bytes: number | null
          tipo: string
        }
        Insert: {
          bucket: string
          club_id: number
          contabilidad_id?: number | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          fecha?: string | null
          filename?: string | null
          id?: number
          nomina_id?: number | null
          path: string
          personal_id?: number | null
          programa_id?: number | null
          size_bytes?: number | null
          tipo: string
        }
        Update: {
          bucket?: string
          club_id?: number
          contabilidad_id?: number | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          fecha?: string | null
          filename?: string | null
          id?: number
          nomina_id?: number | null
          path?: string
          personal_id?: number | null
          programa_id?: number | null
          size_bytes?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "documentos_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "contabilidad"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "documentos_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "vw_contabilidad_pagos_estado"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "documentos_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "vw_sugerencias_conciliacion_1a1"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "documentos_nomina_id_fkey"
            columns: ["nomina_id"]
            isOneToOne: false
            referencedRelation: "contabilidad"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "documentos_nomina_id_fkey"
            columns: ["nomina_id"]
            isOneToOne: false
            referencedRelation: "vw_contabilidad_pagos_estado"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "documentos_nomina_id_fkey"
            columns: ["nomina_id"]
            isOneToOne: false
            referencedRelation: "vw_sugerencias_conciliacion_1a1"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "documentos_personal_id_fkey"
            columns: ["personal_id"]
            isOneToOne: false
            referencedRelation: "personal"
            referencedColumns: ["id_personal"]
          },
          {
            foreignKeyName: "documentos_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas"
            referencedColumns: ["id_programa"]
          },
        ]
      }
      entidades: {
        Row: {
          club_id: number
          created_at: string
          entidad: string
          id_entidad: number
        }
        Insert: {
          club_id: number
          created_at?: string
          entidad: string
          id_entidad?: number
        }
        Update: {
          club_id?: number
          created_at?: string
          entidad?: string
          id_entidad?: number
        }
        Relationships: [
          {
            foreignKeyName: "entidades_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
        ]
      }
      imputaciones: {
        Row: {
          club_id: number
          concepto_id: number | null
          contabilidad_id: number
          created_at: string
          id_imputacion: number
          importe_imputado: number
          iva_recuperable: boolean | null
          programa_id: number | null
          relacion_con_proyecto: string | null
          subvencion_id: number
        }
        Insert: {
          club_id: number
          concepto_id?: number | null
          contabilidad_id: number
          created_at?: string
          id_imputacion?: number
          importe_imputado: number
          iva_recuperable?: boolean | null
          programa_id?: number | null
          relacion_con_proyecto?: string | null
          subvencion_id: number
        }
        Update: {
          club_id?: number
          concepto_id?: number | null
          contabilidad_id?: number
          created_at?: string
          id_imputacion?: number
          importe_imputado?: number
          iva_recuperable?: boolean | null
          programa_id?: number | null
          relacion_con_proyecto?: string | null
          subvencion_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "imputaciones_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "imputaciones_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id_concepto"]
          },
          {
            foreignKeyName: "imputaciones_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "contabilidad"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "imputaciones_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "vw_contabilidad_pagos_estado"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "imputaciones_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "vw_sugerencias_conciliacion_1a1"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "imputaciones_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas"
            referencedColumns: ["id_programa"]
          },
          {
            foreignKeyName: "imputaciones_subvencion_id_fkey"
            columns: ["subvencion_id"]
            isOneToOne: false
            referencedRelation: "subvenciones"
            referencedColumns: ["id_subvencion"]
          },
        ]
      }
      pagos: {
        Row: {
          banco_id: number | null
          club_id: number
          contabilidad_id: number
          created_at: string
          fecha_pago_real: string | null
          id_pago: number
          importe_pagado: number
          metodo: string | null
          observaciones: string | null
        }
        Insert: {
          banco_id?: number | null
          club_id: number
          contabilidad_id: number
          created_at?: string
          fecha_pago_real?: string | null
          id_pago?: number
          importe_pagado: number
          metodo?: string | null
          observaciones?: string | null
        }
        Update: {
          banco_id?: number | null
          club_id?: number
          contabilidad_id?: number
          created_at?: string
          fecha_pago_real?: string | null
          id_pago?: number
          importe_pagado?: number
          metodo?: string | null
          observaciones?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "bancos"
            referencedColumns: ["id_banco"]
          },
          {
            foreignKeyName: "pagos_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "vw_banco_conciliacion_estado"
            referencedColumns: ["id_banco"]
          },
          {
            foreignKeyName: "pagos_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "vw_sugerencias_conciliacion_1a1"
            referencedColumns: ["id_banco"]
          },
          {
            foreignKeyName: "pagos_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "vw_sugerencias_pago_agrupado_factura"
            referencedColumns: ["id_banco"]
          },
          {
            foreignKeyName: "pagos_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "pagos_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "contabilidad"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "pagos_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "vw_contabilidad_pagos_estado"
            referencedColumns: ["id_contabilidad"]
          },
          {
            foreignKeyName: "pagos_contabilidad_id_fkey"
            columns: ["contabilidad_id"]
            isOneToOne: false
            referencedRelation: "vw_sugerencias_conciliacion_1a1"
            referencedColumns: ["id_contabilidad"]
          },
        ]
      }
      perfiles: {
        Row: {
          created_at: string
          email: string | null
          rol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          rol?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          rol?: string
          user_id?: string
        }
        Relationships: []
      }
      personal: {
        Row: {
          activo: boolean
          club_id: number | null
          created_at: string
          id_personal: number
          nif: string | null
          nombre: string
          observaciones: string | null
          tipo: string | null
        }
        Insert: {
          activo?: boolean
          club_id?: number | null
          created_at?: string
          id_personal?: number
          nif?: string | null
          nombre: string
          observaciones?: string | null
          tipo?: string | null
        }
        Update: {
          activo?: boolean
          club_id?: number | null
          created_at?: string
          id_personal?: number
          nif?: string | null
          nombre?: string
          observaciones?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
        ]
      }
      presupuesto_partidas: {
        Row: {
          club_id: number
          concepto_id: number
          concepto_nombre_snapshot: string | null
          created_at: string
          descripcion: string | null
          id_partida: number
          importe_presupuestado: number
          naturaleza_snapshot: string | null
          orden: number
          presupuesto_id: number
          subvencionabilidad_snapshot: string | null
          updated_at: string
        }
        Insert: {
          club_id: number
          concepto_id: number
          concepto_nombre_snapshot?: string | null
          created_at?: string
          descripcion?: string | null
          id_partida?: number
          importe_presupuestado: number
          naturaleza_snapshot?: string | null
          orden?: number
          presupuesto_id: number
          subvencionabilidad_snapshot?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: number
          concepto_id?: number
          concepto_nombre_snapshot?: string | null
          created_at?: string
          descripcion?: string | null
          id_partida?: number
          importe_presupuestado?: number
          naturaleza_snapshot?: string | null
          orden?: number
          presupuesto_id?: number
          subvencionabilidad_snapshot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_partidas_concepto_club_fkey"
            columns: ["concepto_id", "club_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id_concepto", "club_id"]
          },
          {
            foreignKeyName: "presupuesto_partidas_presupuesto_club_fkey"
            columns: ["presupuesto_id", "club_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id_presupuesto", "club_id"]
          },
        ]
      }
      presupuesto_programas: {
        Row: {
          club_id: number
          created_at: string
          id_presupuesto_programa: number
          presupuesto_id: number
          programa_id: number
        }
        Insert: {
          club_id: number
          created_at?: string
          id_presupuesto_programa?: number
          presupuesto_id: number
          programa_id: number
        }
        Update: {
          club_id?: number
          created_at?: string
          id_presupuesto_programa?: number
          presupuesto_id?: number
          programa_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_programas_presupuesto_club_fkey"
            columns: ["presupuesto_id", "club_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id_presupuesto", "club_id"]
          },
          {
            foreignKeyName: "presupuesto_programas_programa_club_fkey"
            columns: ["programa_id", "club_id"]
            isOneToOne: false
            referencedRelation: "programas"
            referencedColumns: ["id_programa", "club_id"]
          },
        ]
      }
      presupuestos: {
        Row: {
          anio_fin: number
          anio_inicio: number
          cerrado_at: string | null
          club_id: number
          created_at: string
          created_by: string | null
          estado: string
          fecha_fin: string
          fecha_inicio: string
          id_presupuesto: number
          nombre: string
          observaciones: string | null
          periodo_tipo: string
          serie_id: string
          subtipo_programa: string | null
          subvencion_id: number | null
          tipo_programa: string
          updated_at: string
          version: number
        }
        Insert: {
          anio_fin: number
          anio_inicio: number
          cerrado_at?: string | null
          club_id: number
          created_at?: string
          created_by?: string | null
          estado?: string
          fecha_fin: string
          fecha_inicio: string
          id_presupuesto?: number
          nombre: string
          observaciones?: string | null
          periodo_tipo: string
          serie_id?: string
          subtipo_programa?: string | null
          subvencion_id?: number | null
          tipo_programa: string
          updated_at?: string
          version?: number
        }
        Update: {
          anio_fin?: number
          anio_inicio?: number
          cerrado_at?: string | null
          club_id?: number
          created_at?: string
          created_by?: string | null
          estado?: string
          fecha_fin?: string
          fecha_inicio?: string
          id_presupuesto?: number
          nombre?: string
          observaciones?: string | null
          periodo_tipo?: string
          serie_id?: string
          subtipo_programa?: string | null
          subvencion_id?: number | null
          tipo_programa?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "presupuestos_subvencion_club_fkey"
            columns: ["subvencion_id", "club_id"]
            isOneToOne: false
            referencedRelation: "subvenciones"
            referencedColumns: ["id_subvencion", "club_id"]
          },
        ]
      }
      programas: {
        Row: {
          activo: boolean
          anio: number | null
          club_id: number
          created_at: string
          fecha_limite: string | null
          id_programa: number
          programa: string
          subvencion: number | null
          tipo_programa: string
        }
        Insert: {
          activo?: boolean
          anio?: number | null
          club_id: number
          created_at?: string
          fecha_limite?: string | null
          id_programa?: number
          programa: string
          subvencion?: number | null
          tipo_programa?: string
        }
        Update: {
          activo?: boolean
          anio?: number | null
          club_id?: number
          created_at?: string
          fecha_limite?: string | null
          id_programa?: number
          programa?: string
          subvencion?: number | null
          tipo_programa?: string
        }
        Relationships: [
          {
            foreignKeyName: "programas_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
        ]
      }
      programas_alias: {
        Row: {
          club_id: number
          id_alias: number
          programa_id: number
          programa_txt: string
        }
        Insert: {
          club_id: number
          id_alias?: number
          programa_id: number
          programa_txt: string
        }
        Update: {
          club_id?: number
          id_alias?: number
          programa_id?: number
          programa_txt?: string
        }
        Relationships: [
          {
            foreignKeyName: "programas_alias_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "programas_alias_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas"
            referencedColumns: ["id_programa"]
          },
        ]
      }
      proveedores: {
        Row: {
          activo: boolean
          cif: string | null
          club_id: number
          contacto: string | null
          created_at: string
          domicilio: string | null
          email: string | null
          id_proveedor: number
          proveedor: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          cif?: string | null
          club_id: number
          contacto?: string | null
          created_at?: string
          domicilio?: string | null
          email?: string | null
          id_proveedor?: number
          proveedor: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          cif?: string | null
          club_id?: number
          contacto?: string | null
          created_at?: string
          domicilio?: string | null
          email?: string | null
          id_proveedor?: number
          proveedor?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
        ]
      }
      stg_contabilidad: {
        Row: {
          bruto: number | null
          bruto_imputado: number | null
          categoria: string | null
          cif: string | null
          club_id: number
          concepto: string | null
          coste_empresarial: number | null
          entidad: string | null
          fecha: string | null
          fecha_pago: string | null
          gastos_generales_club: string | null
          importe_imputado: number | null
          importe_total: number | null
          numero_factura: string | null
          personal: string | null
          programa: string | null
          proveedor: string | null
          relacion_con_proyecto: string | null
          ss: number | null
          ss_imputado: number | null
          tipo: string | null
        }
        Insert: {
          bruto?: number | null
          bruto_imputado?: number | null
          categoria?: string | null
          cif?: string | null
          club_id: number
          concepto?: string | null
          coste_empresarial?: number | null
          entidad?: string | null
          fecha?: string | null
          fecha_pago?: string | null
          gastos_generales_club?: string | null
          importe_imputado?: number | null
          importe_total?: number | null
          numero_factura?: string | null
          personal?: string | null
          programa?: string | null
          proveedor?: string | null
          relacion_con_proyecto?: string | null
          ss?: number | null
          ss_imputado?: number | null
          tipo?: string | null
        }
        Update: {
          bruto?: number | null
          bruto_imputado?: number | null
          categoria?: string | null
          cif?: string | null
          club_id?: number
          concepto?: string | null
          coste_empresarial?: number | null
          entidad?: string | null
          fecha?: string | null
          fecha_pago?: string | null
          gastos_generales_club?: string | null
          importe_imputado?: number | null
          importe_total?: number | null
          numero_factura?: string | null
          personal?: string | null
          programa?: string | null
          proveedor?: string | null
          relacion_con_proyecto?: string | null
          ss?: number | null
          ss_imputado?: number | null
          tipo?: string | null
        }
        Relationships: []
      }
      subvencion_programas: {
        Row: {
          club_id: number
          id_subvencion_programa: number
          presupuesto_previsto: number | null
          programa_id: number
          subvencion_id: number
        }
        Insert: {
          club_id: number
          id_subvencion_programa?: number
          presupuesto_previsto?: number | null
          programa_id: number
          subvencion_id: number
        }
        Update: {
          club_id?: number
          id_subvencion_programa?: number
          presupuesto_previsto?: number | null
          programa_id?: number
          subvencion_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "subvencion_programas_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "subvencion_programas_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas"
            referencedColumns: ["id_programa"]
          },
          {
            foreignKeyName: "subvencion_programas_subvencion_id_fkey"
            columns: ["subvencion_id"]
            isOneToOne: false
            referencedRelation: "subvenciones"
            referencedColumns: ["id_subvencion"]
          },
        ]
      }
      subvenciones: {
        Row: {
          administracion: string | null
          anio: number
          club_id: number
          convocatoria: string | null
          created_at: string
          estado: string
          fecha_fin_gasto: string | null
          fecha_inicio_gasto: string | null
          fecha_limite_justificacion: string | null
          id_subvencion: number
          importe_concedido: number | null
          importe_solicitado: number | null
          nombre: string
          ref_expediente: string | null
        }
        Insert: {
          administracion?: string | null
          anio: number
          club_id: number
          convocatoria?: string | null
          created_at?: string
          estado?: string
          fecha_fin_gasto?: string | null
          fecha_inicio_gasto?: string | null
          fecha_limite_justificacion?: string | null
          id_subvencion?: number
          importe_concedido?: number | null
          importe_solicitado?: number | null
          nombre: string
          ref_expediente?: string | null
        }
        Update: {
          administracion?: string | null
          anio?: number
          club_id?: number
          convocatoria?: string | null
          created_at?: string
          estado?: string
          fecha_fin_gasto?: string | null
          fecha_inicio_gasto?: string | null
          fecha_limite_justificacion?: string | null
          id_subvencion?: number
          importe_concedido?: number | null
          importe_solicitado?: number | null
          nombre?: string
          ref_expediente?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subvenciones_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
        ]
      }
      tipos: {
        Row: {
          club_id: number
          created_at: string
          id_tipo: number
          tipo: string
        }
        Insert: {
          club_id: number
          created_at?: string
          id_tipo?: number
          tipo: string
        }
        Update: {
          club_id?: number
          created_at?: string
          id_tipo?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
        ]
      }
      user_clubs: {
        Row: {
          club_id: number
          club_rol: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          club_id: number
          club_rol?: string
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          club_id?: number
          club_rol?: string
          created_at?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_clubs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
        ]
      }
    }
    Views: {
      vw_banco_conciliacion_estado: {
        Row: {
          club_id: number | null
          concepto_id: number | null
          detalle: string | null
          fecha_operativa: string | null
          id_banco: number | null
          importe: number | null
          importe_abs: number | null
          libre: number | null
          programa_id: number | null
          referencia_1: string | null
          referencia_2: string | null
          repartido: number | null
          saldo: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bancos_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "bancos_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id_concepto"]
          },
          {
            foreignKeyName: "bancos_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas"
            referencedColumns: ["id_programa"]
          },
        ]
      }
      vw_contabilidad_pagos_estado: {
        Row: {
          cif: string | null
          club_id: number | null
          concepto_id: number | null
          fecha: string | null
          fecha_pago: string | null
          id_contabilidad: number | null
          importe_total: number | null
          numero_factura: string | null
          pagado: number | null
          pendiente: number | null
          programa_id: number | null
          proveedor: string | null
          proveedor_id: number | null
          relacion_con_proyecto: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contabilidad_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "contabilidad_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id_concepto"]
          },
          {
            foreignKeyName: "contabilidad_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas"
            referencedColumns: ["id_programa"]
          },
          {
            foreignKeyName: "contabilidad_proveedor_fk"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id_proveedor"]
          },
          {
            foreignKeyName: "contabilidad_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id_proveedor"]
          },
        ]
      }
      vw_sugerencias_conciliacion_1a1: {
        Row: {
          club_id: number | null
          detalle: string | null
          dias_dif: number | null
          fecha_factura: string | null
          fecha_operativa: string | null
          id_banco: number | null
          id_contabilidad: number | null
          importe: number | null
          importe_total: number | null
          libre: number | null
          numero_factura: string | null
          pendiente: number | null
          proveedor: string | null
          referencia_1: string | null
          referencia_2: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contabilidad_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
        ]
      }
      vw_sugerencias_pago_agrupado_factura: {
        Row: {
          banco_abs: number | null
          club_id: number | null
          dias_dif: number | null
          fecha_operativa: string | null
          id_banco: number | null
          ids_contabilidad: string | null
          importe: number | null
          numero_factura: string | null
          proveedor: string | null
          proveedor_id: number | null
          total_a_pagar: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contabilidad_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id_club"]
          },
          {
            foreignKeyName: "contabilidad_proveedor_fk"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id_proveedor"]
          },
          {
            foreignKeyName: "contabilidad_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id_proveedor"]
          },
        ]
      }
    }
    Functions: {
      anadir_miembro_por_email: {
        Args: { p_club_id: number; p_email: string; p_rol: string }
        Returns: undefined
      }
      assert_presupuesto_borrador: {
        Args: {
          p_club_id: number
          p_operacion: string
          p_presupuesto_id: number
        }
        Returns: undefined
      }
      cambiar_rol_miembro: {
        Args: { p_club_id: number; p_new_rol: string; p_user_id: string }
        Returns: undefined
      }
      can_access_club: { Args: { p_club_id: number }; Returns: boolean }
      can_edit_club: { Args: { p_club_id: number }; Returns: boolean }
      crear_club_y_owner: {
        Args: {
          p_direccion?: string
          p_email?: string
          p_nif?: string
          p_nombre: string
          p_telefono?: string
        }
        Returns: number
      }
      eliminar_miembro: {
        Args: { p_club_id: number; p_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
