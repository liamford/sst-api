import { AddPointsUseCase } from '@/domain/use-cases/add-points-use-case';
const addPointsUseCase = new AddPointsUseCase();
export const handler = async (event) => {
    return await addPointsUseCase.execute(event);
};
//# sourceMappingURL=sfn-add-points.js.map