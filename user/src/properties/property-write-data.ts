import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { clearedFieldsFor } from './property-type-fields';

const keywordRows = (keywords: string[]) =>
  keywords.map((keyword) => ({ keyword }));

/** The row (and its keywords) to insert for a new listing of `userId`. */
export function toCreateData(userId: string, dto: CreatePropertyDto) {
  const { status, keywords, ...fields } = dto;
  return {
    ...fields,
    ...clearedFieldsFor(fields.propertyType),
    userId,
    status: status || 'Draft',
    ...(keywords?.length && { keywords: { create: keywordRows(keywords) } }),
  };
}

/**
 * The changes to write for an edit of a listing currently of `currentType`.
 * Details that do not belong to the resulting type are cleared, and a sent
 * keyword list replaces the old one.
 */
export function toUpdateData(dto: UpdatePropertyDto, currentType: string) {
  const { keywords, ...fields } = dto;
  return {
    ...fields,
    ...clearedFieldsFor(fields.propertyType ?? currentType),
    ...(keywords && {
      keywords: { deleteMany: {}, create: keywordRows(keywords) },
    }),
  };
}
