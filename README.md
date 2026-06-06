# Control económico del club

Proyecto de control económico, subvenciones y conciliación bancaria basado en Next.js + Supabase.

## Tecnologías

- Next.js
- React
- TypeScript
- Supabase Auth, PostgreSQL y Storage

## Desarrollo

```bash
npm install
npm run dev
```

## Verificación

```bash
npm run lint
npm run build
```

## Supabase

Las variables sensibles se gestionan con `.env.local`, que no debe subirse al repositorio.

Para generar tipos TypeScript desde el proyecto remoto:

```bash
$env:SUPABASE_ACCESS_TOKEN="tu-token"
npm run supabase:types
```

El comando genera:

```text
src/lib/supabase/database.types.ts
```

El token se obtiene desde la cuenta de Supabase y debe configurarse solo como variable de entorno local.
