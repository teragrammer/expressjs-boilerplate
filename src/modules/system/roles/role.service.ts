// src/modules/system/roles/role.service.ts
import {
    BrowseRoleQuery,
    CreateRoleDTO,
    Role,
    UpdateRoleDTO,
} from "./role.interface";
import {RoleRepository} from "./role.repository";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";

export class RoleService {
    constructor(
        private readonly roleRepository: RoleRepository,
    ) {
    }

    /**
     * Retrieves a role by its slug or throws an error if not found.
     */
    async getRoleBySlug(slug: string): Promise<Role> {
        const role = await this.roleRepository.findBySlug(slug);

        if (!role) {
            throw new AppError(
                Messages.DATA_NOT_FOUND,
                `Role with slug '${slug}' not found`,
            );
        }

        return role;
    }

    async createRole(data: CreateRoleDTO): Promise<Role> {
        return this.roleRepository.create(data);
    }

    async updateRole(
        id: number,
        data: UpdateRoleDTO,
    ): Promise<Role> {
        const role: Role | null = await this.roleRepository.update(id, data);

        if (!role) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        return role;
    }

    async browseRoles(
        filters: BrowseRoleQuery,
    ): Promise<Role[]> {
        const MAX_PER_PAGE = 100;

        const page = Math.max(
            1,
            filters.page || 1,
        );

        const perPage = Math.min(
            MAX_PER_PAGE,
            Math.max(
                1,
                filters.perPage || 20,
            ),
        );

        const normalizedFilters: BrowseRoleQuery = {
            ...filters,
            page,
            perPage,
            search: filters.search?.trim() || undefined,
        };

        return this.roleRepository.browse(normalizedFilters);
    }

    async findById(id: number): Promise<Role> {
        const role = await this.roleRepository.findById(id);

        if (!role) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        return role;
    }

    /**
     * Deletes a role.
     *
     * The foreign keys use `ON DELETE RESTRICT`, so a role that is
     * still assigned to users or route guards cannot be removed. The
     * check is explicit so the client receives a 409 with a clear
     * message instead of a generic database error.
     */
    async hardDelete(id: number): Promise<void> {
        const role = await this.roleRepository.findById(id);

        if (!role) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        const inUse = await this.roleRepository.countUsers(id);
        const guardCount = await this.roleRepository.countRouteGuards(id);

        if (inUse > 0 || guardCount > 0) {
            throw new AppError(
                Messages.DUPLICATE_DATA,
                "This role is still assigned to users or route guards. " +
                "Reassign or remove them before deleting the role.",
            );
        }

        const deleted = await this.roleRepository.delete(id);

        if (!deleted) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }
    }
}
