export const VectorMethodEnum = {
    "cosineDistance": "cosineDistance",
    "l1Distance": "l1Distance",
    "l2Distance": "l2Distance",
    "hammingDistance": "hammingDistance",
    "jaccardDistance": "jaccardDistance",
    "maxInnerProduct": "maxInnerProduct"
} as const;

export type VectorMethod = (typeof VectorMethodEnum)[keyof typeof VectorMethodEnum];