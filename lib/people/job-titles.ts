/**
 * Whether a new job title starts out managerial, so its holder may lead a team or
 * start a project. It follows from the name (a manager, a lead, a head of…), so whoever
 * adds a title never has to say so; a super admin can still correct it per title on the
 * People page. English and Polish words are both understood. The migration
 * 20261114120000_managerial_titles_by_word applies the same list in SQL: keep them in step.
 */
const MANAGERIAL = /\b(manager|lead|leader|head|director|chief|vp|cto|ceo|coo|cfo|cio|kierownik|kierowniczka|dyrektor|dyrektorka|lider|liderka|szef|szefowa)\b/i;

export function isManagerialTitle(name: string) {
  return MANAGERIAL.test(name);
}
