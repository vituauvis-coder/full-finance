# Cofrinhos rename — design spec

## Summary

Unify savings jars under **Cofrinhos**: full rename of the former Investimentos feature (`investment_*` → `cofrinho_*`), remove the legacy Objetivos screen (`Goal` table and `/api/goals`), rename expense category `Investimentos` → `Cofrinhos` and flag `isInvestment` → `isCofrinho`. No migration of old Goal rows.

## Database

Migration: `prisma/migrations/20260517130000_cofrinhos_rename/migration_pg.sql`

- `investment_buckets` → `cofrinho_buckets`
- `investment_applications` → `cofrinho_applications`
- `investment_bucket_goals` → `cofrinho_bucket_goals`
- `expenses.is_investment` → `is_cofrinho`
- `DROP TABLE goals`
- Update category/expense labels to `Cofrinhos`

## API

- `/api/cofrinho-buckets`, `/api/cofrinho-applications`, `/api/cofrinho-bucket-goals`
- Bundle `/api/data`: `cofrinhoBuckets`, `cofrinhoApplications`, `cofrinhoBucketGoals`
- Removed `/api/goals`

## Frontend

- Page id: `cofrinhos` (`#cofrinhos-page`)
- Module: `js/features/cofrinhos/`
- Styles: `css/pages/cofrinhos.css`

## Deploy note

Run the new migration on PostgreSQL before starting the updated server.
