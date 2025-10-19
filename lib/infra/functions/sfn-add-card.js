import { AddCardUseCase } from '@/domain/use-cases/add-card-use-case';
const addCardUseCase = new AddCardUseCase();
export const handler = async (event) => {
    return await addCardUseCase.execute(event);
};
//# sourceMappingURL=sfn-add-card.js.map