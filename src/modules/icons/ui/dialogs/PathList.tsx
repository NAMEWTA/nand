import { useState } from 'react';
import type { Category, FileItem } from '../../core/types';
import type IconicController from '../../platform/host/controller';
import { useT } from '../../../../ui/react/hooks';
import { Choice } from '../../../../ui/components/nand/Choice';
import { Button } from '../../../../ui/components/button';
import { IconPreview } from '../IconPreview';
import IconPicker from './icon-picker';
export function PathList({
	plugin,
	initial,
	page,
	unused = false,
}: {
	plugin: IconicController;
	initial: FileItem[];
	page?: Category;
	unused?: boolean;
}) {
	const t = useT(),
		[items, setItems] = useState(initial),
		[highlight, setHighlight] = useState('tree');
	return (
		<div className="space-y-4">
			<Choice
				label={t('iconic.ruleChecker.highlight')}
				value={highlight}
				options={(page === 'folder' ? ['tree', 'name'] : ['tree', 'name', 'extension']).map((v) => [
					v,
					t(`iconic.ruleEditor.source.${v}`),
				])}
				onChange={setHighlight}
			/>
			<div className="divide-y divide-border">
				{items.map((item) => {
					const { tree, basename, extension } = plugin.splitFilePath(item.id),
						ruled = page ? plugin.ruleManager?.checkRuling(page, item.id) : undefined;
					const style = (part: string) =>
						part === highlight ? 'font-medium text-foreground' : 'text-muted-foreground';
					return (
						<div key={item.id} className="flex items-center gap-2 py-2">
							<Button
								variant="ghost"
								size="icon"
								aria-label={t('iconic.iconPicker.changeIcon')}
								onClick={() =>
									IconPicker.openSingle(plugin, item, (icon, color) => {
										plugin.saveFileIcon(item, icon, color);
										item.icon = icon;
										item.color = color;
										setItems([...items]);
									})
								}
							>
								<IconPreview
									icon={
										ruled?.icon ??
										item.icon ??
										(page === 'folder' ? 'lucide-folder' : 'lucide-file')
									}
									color={ruled?.color ?? item.color}
								/>
							</Button>
							<span className="min-w-0 flex-1 break-all text-sm">
								<span className={style('tree')}>{tree}</span>
								<span className={style('name')}>{basename}</span>
								{extension && <span className={style('extension')}>.{extension}</span>}
							</span>
							{unused && (
								<Button
									variant="ghost"
									onClick={() => {
										plugin.saveFileIcon(item, null, null);
										setItems(items.filter((i) => i !== item));
									}}
								>
									{t('iconic.menu.removeIcon')}
								</Button>
							)}
						</div>
					);
				})}
				{unused && !items.length && (
					<p role="status" className="py-6 text-center text-sm text-muted-foreground">
						{t('iconic.usageChecker.noUnusedIconsFound')}
					</p>
				)}
			</div>
		</div>
	);
}
