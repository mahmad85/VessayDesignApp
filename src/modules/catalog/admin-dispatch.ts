import type { NextRequest } from 'next/server';
import { adminBody, adminRoute, json } from '@/lib/admin-http';
import { missing } from '@/db/admin-mutations';
import {
  bulkValues,
  createStructure,
  deleteCatalogEntity,
  duplicateGroup,
  editStructure,
  listStructure,
  removeProductLink,
  reorderStructure,
  setProductLink,
  setProductSettings,
  structureTables,
} from '@/db/catalog-structure-repository';
import { productTree, workingCatalog } from '@/db/catalog-working';
import {
  listMaterials,
  materialDetail,
  saveMaterial,
  setAvailability,
  setMaterialMedia,
  setMaterialOverrides,
  bulkMaterials,
  duplicateMaterial,
  clearReference,
} from '@/db/material-repository';
import {
  listTemplates,
  templateDetail,
  saveTemplate,
  setTemplateMedia,
  duplicateTemplate,
  templateFromPreview,
} from '@/db/template-repository';
import { simulation } from '@/db/pricing-admin-repository';
import { catalogStatus, catalogDiff, listReleases, releaseDetail } from '@/db/catalog-publishing';
import {
  publish,
  publishInput,
  getRelease,
  restoreCatalog,
  ensureCatalog,
  catalogAutoBootstrap,
} from '@/db/release-repository';
import { z } from 'zod';
import { toCustomerCatalog } from './projection';
import type { StructureEntity } from './admin-input';

/** HTTP dispatch only; validation, business rules and transactions live in repositories. */
export async function catalogDispatch(request: NextRequest, segments: string[]) {
  const [entity, id, action] = segments;
  const publishing =
    entity === 'publish' || action === 'restore' || action === 'clear-reference-only';
  const read =
    request.method === 'GET' || entity === 'validate' || (entity === 'rules' && id === 'evaluate');
  return adminRoute(
    request,
    publishing ? 'catalog.publish' : read ? 'catalog.read' : 'catalog.write',
    async (staff) => {
      if (catalogAutoBootstrap()) await ensureCatalog();
      const [entity, id, action, target] = segments;
      const method = request.method;
      const actor = `user:${staff.userId}`;
      const input = () => adminBody(request, id === 'bulk' || entity === 'reorder');
      if (entity === 'working' && method === 'GET')
        return json(toCustomerCatalog((await workingCatalog()).snapshot));
      if (entity === 'status' && method === 'GET') return json(await catalogStatus());
      if (entity === 'validate' && method === 'POST') return json((await workingCatalog()).report);
      if (entity === 'diff' && method === 'GET') return json(await catalogDiff());
      if (entity === 'publish' && method === 'POST')
        return json(await publish(actor, publishInput.parse(await input())), undefined, 201);
      if (entity === 'releases') {
        if (!id && method === 'GET')
          return json(await listReleases(Object.fromEntries(request.nextUrl.searchParams)));
        if (id && !action && method === 'GET') return json(await releaseDetail(id));
        if (id && action === 'snapshot' && method === 'GET') {
          const release = await getRelease(z.coerce.number().int().positive().parse(id));
          if (!release) return missing();
          const response = json(release.snapshot);
          response.headers.set(
            'Content-Disposition',
            `attachment; filename="catalog-v${release.version}.json"`,
          );
          return response;
        }
        if (id && action === 'restore' && method === 'POST')
          return json(
            await restoreCatalog(
              actor,
              z.coerce.number().int().positive().parse(id),
              await input(),
            ),
          );
      }
      if (action === 'clear-reference-only' && method === 'POST')
        return json(await clearReference(entity, id, await input(), actor));
      if (entity === 'rules' && id === 'evaluate' && method === 'POST')
        return json(await simulation(await input()));
      if (entity === 'materials') {
        if (!id && method === 'GET')
          return json(await listMaterials(Object.fromEntries(request.nextUrl.searchParams)));
        if (!id && method === 'POST')
          return json(await saveMaterial(null, await input(), actor), undefined, 201);
        if (id === 'bulk' && method === 'POST')
          return json(await bulkMaterials(await input(), actor));
        if (id && !action && method === 'GET') return json(await materialDetail(id));
        if (id && !action && method === 'PATCH')
          return json(await saveMaterial(id, await input(), actor));
        if (action === 'availability' && method === 'PATCH')
          return json(await setAvailability(id, await input(), actor));
        if (action === 'media' && method === 'PUT')
          return json(await setMaterialMedia(id, await input(), actor));
        if (action === 'price-overrides' && method === 'PUT')
          return json(await setMaterialOverrides(id, await input(), actor));
        if (action === 'duplicate' && method === 'POST')
          return json(await duplicateMaterial(id, await input(), actor), undefined, 201);
      }
      if (entity === 'templates') {
        if (id === 'from-preview' && method === 'POST')
          return json(await templateFromPreview(staff.userId, await input()), undefined, 201);
        if (!id && method === 'GET')
          return json(await listTemplates(Object.fromEntries(request.nextUrl.searchParams)));
        if (!id && method === 'POST')
          return json(await saveTemplate(null, await input(), actor), undefined, 201);
        if (id && !action && method === 'GET') return json(await templateDetail(id));
        if (id && !action && method === 'PATCH')
          return json(await saveTemplate(id, await input(), actor));
        if (action === 'media' && method === 'PUT')
          return json(await setTemplateMedia(id, await input(), actor));
        if (action === 'duplicate' && method === 'POST')
          return json(await duplicateTemplate(id, await input(), actor), undefined, 201);
      }
      if (
        (entity === 'materials' || entity === 'templates') &&
        id &&
        !action &&
        method === 'DELETE'
      )
        return json(await deleteCatalogEntity(entity, id, actor));
      if (entity === 'products' && id && action === 'tree' && method === 'GET')
        return json(await productTree(id));
      if (entity === 'products' && id && action === 'components' && target) {
        if (method === 'PUT') return json(await setProductLink(id, target, await input(), actor));
        if (method === 'DELETE') return json(await removeProductLink(id, target, actor));
      }
      if (entity === 'products' && id && action === 'settings' && method === 'PUT')
        return json(await setProductSettings(id, await input(), actor));
      if (entity === 'values' && id === 'bulk' && method === 'POST')
        return json(await bulkValues(await input(), actor));
      if (entity === 'reorder' && method === 'POST')
        return json(await reorderStructure(await input(), actor));
      if (entity === 'groups' && id && action === 'duplicate' && method === 'POST')
        return json(await duplicateGroup(id, await input(), actor), undefined, 201);
      const child =
        entity === 'components' && action === 'groups'
          ? 'groups'
          : entity === 'groups' && action === 'attributes'
            ? 'attributes'
            : entity === 'attributes' && action === 'values'
              ? 'values'
              : null;
      if (child && id && method === 'POST')
        return json(await createStructure(child, await input(), actor, id), undefined, 201);
      if (entity in structureTables && !action) {
        const type = entity as StructureEntity;
        if (method === 'GET' && !id)
          return json({
            items: await listStructure(type, Object.fromEntries(request.nextUrl.searchParams)),
          });
        if (method === 'POST' && !id)
          return json(await createStructure(type, await input(), actor), undefined, 201);
        if (method === 'PATCH' && id)
          return json(await editStructure(type, id, await input(), actor));
        if (method === 'DELETE' && id) return json(await deleteCatalogEntity(type, id, actor));
      }
      return missing();
    },
    publishing ? { limit: 'publish' } : {},
  );
}
