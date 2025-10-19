import { UpdateUserUseCase } from '@/domain/use-cases/update-user-use-case';
const updateUserUseCase = new UpdateUserUseCase();
export const handler = async (event) => {
    return await updateUserUseCase.execute(event);
};
//# sourceMappingURL=sfn-update-user.js.map