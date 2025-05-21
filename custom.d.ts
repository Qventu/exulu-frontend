declare namespace JSX {
    interface IntrinsicElements {
        'ldrs-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
            speed: string
            stroke: string
            size: string
            color: string
        }
    }
}