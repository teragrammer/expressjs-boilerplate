export function ValidationUtil() {
    return {
        isInteger(data: any) {
            return !/^\d+$/.test(data) || !Number.isInteger(Number(data))
        }
    }
}