-- Managerial job titles follow one rule everywhere: a whole word in the name
-- (the same list as isManagerialTitle in lib/people/job-titles.ts). The first
-- job titles migration matched any part of a word ("lead" in "Leadership").
UPDATE "JobTitle" SET "can_lead" = "name" ~* '\m(manager|lead|leader|head|director|chief|vp|cto|ceo|coo|cfo|cio|kierownik|kierowniczka|dyrektor|dyrektorka|lider|liderka|szef|szefowa)\M';

-- A lead whose title cannot lead is no longer one.
UPDATE "User" u SET "team_lead" = false
WHERE u."team_lead" AND NOT EXISTS (SELECT 1 FROM "JobTitle" j WHERE j."id" = u."job_title_id" AND j."can_lead");
