const Formats = {
    formatNumber(num) {
        return new Intl.NumberFormat("en", { notation: "compact" }).format(num);
    },
    formatName(name) {
        return name
            .trim() // remove leading/trailing spaces
            .toLowerCase() // make lowercase
            .replace(/\s+/g, "-"); // replace spaces with "-"
    },
};

export const { formatNumber, formatName } = Formats;
