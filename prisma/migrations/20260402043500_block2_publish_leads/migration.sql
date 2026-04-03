ALTER TYPE "LeadResolution" RENAME TO "LeadResolution_old";

CREATE TYPE "LeadResolution" AS ENUM (
  'OPEN',
  'IN_CONVERSATION',
  'INTERESTED',
  'CLOSED',
  'LOST'
);

ALTER TABLE "Lead"
ALTER COLUMN "resolution" DROP DEFAULT;

ALTER TABLE "Lead"
ALTER COLUMN "resolution" TYPE "LeadResolution"
USING (
  CASE
    WHEN "resolution"::text = 'WON' THEN 'CLOSED'
    WHEN "resolution"::text = 'ARCHIVED' THEN 'CLOSED'
    ELSE "resolution"::text
  END
)::"LeadResolution";

ALTER TABLE "Lead"
ALTER COLUMN "resolution" SET DEFAULT 'OPEN';

DROP TYPE "LeadResolution_old";
