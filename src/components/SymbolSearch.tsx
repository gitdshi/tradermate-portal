import { useQuery } from '@tanstack/react-query'
import { Check, Search, TrendingUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { marketDataAPI } from '../lib/api'

interface Stock {
	symbol: string
	name?: string
	vt_symbol?: string
	ts_code?: string
	exchange?: string
	market?: string
}

interface SymbolSearchProps {
	onSelect?: (symbol: string) => void
	onChoose?: (stock: Stock) => void
	onToggle?: (stock: Stock) => void
	multi?: boolean
	selected?: Map<string, Stock>
	placeholder?: string
}

export default function SymbolSearch({ onSelect, onChoose, onToggle, multi = false, selected, placeholder = 'Search symbols (e.g., AAPL, MSFT)...' }: SymbolSearchProps) {
	const [searchTerm, setSearchTerm] = useState('')
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
	const [showDropdown, setShowDropdown] = useState(false)
	const wrapperRef = useRef<HTMLDivElement | null>(null)
	const inputRef = useRef<HTMLInputElement | null>(null)
	const [selectedMarket, setSelectedMarket] = useState<string>('')

	const { data: symbolsData, isLoading } = useQuery({
		queryKey: ['symbols', selectedMarket, debouncedSearchTerm],
		queryFn: () => marketDataAPI.symbols(selectedMarket || undefined, debouncedSearchTerm || undefined, 50, 0),
		keepPreviousData: true,
	})

	const symbols = symbolsData?.data || []

	const handleClick = (s: Stock) => {
		if (multi && onToggle) {
			onToggle(s)
			// keep dropdown open and keep user's search term for multi-select
			setShowDropdown(true)
			// focus back to input for quick additional typing
			setTimeout(() => inputRef.current?.focus(), 0)
			return
		}
		if (onChoose) {
			onChoose(s)
			// clear input and close dropdown for single-select choices
			setSearchTerm('')
			setShowDropdown(false)
			return
		}
		if (onSelect) {
			onSelect(s.symbol)
		}
		setSearchTerm('')
		setShowDropdown(false)
		}

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
				setShowDropdown(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	// Debounce search term to avoid firing requests on every keystroke
	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedSearchTerm(searchTerm.trim())
		}, 250)
		return () => clearTimeout(handler)
	}, [searchTerm])

	return (
		<div ref={wrapperRef} className="space-y-4">
			<div className="flex items-center gap-3">
				<div className="flex-1 relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<input
						type="text"
						value={searchTerm}
					onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true) }}
						placeholder={placeholder}
						autoComplete="off"
						className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<select
					value={selectedMarket}
					onChange={(e) => setSelectedMarket(e.target.value)}
					className="px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="">All Markets</option>
					<option value="US">US Markets</option>
					<option value="CN">China Markets</option>
					<option value="HK">Hong Kong</option>
				</select>
			</div>

			{showDropdown && (
				<>
					{isLoading && (
						<div className="text-center py-8 text-muted-foreground">Loading symbols...</div>
					)}
						{!isLoading && debouncedSearchTerm && (
						<div className="bg-card border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
							{symbols.length === 0 ? (
								<div className="p-8 text-center text-muted-foreground">No symbols found matching "{debouncedSearchTerm}"</div>
							) : (
								<div className="divide-y divide-border">
									{symbols.slice(0, 20).map((sym: any) => (
										<button key={sym.symbol} type="button" onClick={() => handleClick(sym)} className="w-full p-4 hover:bg-muted transition-colors text-left">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
														<TrendingUp className="h-5 w-5 text-primary" />
													</div>
													<div>
														<div className="font-semibold">{sym.symbol}</div>
														{sym.name && (
															<div className="text-sm text-muted-foreground">{sym.name}</div>
														)}
													</div>
												</div>
												<div className="flex items-center gap-2">
													{sym.market && <span className="text-xs px-2 py-1 bg-muted rounded">{sym.market}</span>}
													{selected && (selected.has(sym.ts_code || sym.vt_symbol)) && (
														<Check className="h-4 w-4 text-primary" />
													)}
												</div>
											</div>
										</button>
									))}
								</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	)
}
