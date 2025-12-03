import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
  Self,
  signal,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  FormsModule,
  NgControl,
  ReactiveFormsModule
} from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent
} from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { IonIcon } from '@ionic/angular/standalone';
import { Tag } from '@prisma/client';
import { addIcons } from 'ionicons';
import { addCircleOutline, closeOutline } from 'ionicons/icons';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    IonIcon,
    MatAutocompleteModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'gf-tags-selector',
  styleUrls: ['./tags-selector.component.scss'],
  templateUrl: 'tags-selector.component.html'
})
export class GfTagsSelectorComponent
  implements ControlValueAccessor, OnChanges, OnDestroy, OnInit
{
  @Input() hasPermissionToCreateTag = false;
  @Input() readonly = false;
  @Input() tags: Tag[];
  @Input() tagsAvailable: Tag[];

  @ViewChild('tagInput') tagInput: ElementRef<HTMLInputElement>;

  public filteredOptions: Subject<Tag[]> = new BehaviorSubject([]);
  public readonly separatorKeysCodes: number[] = [COMMA, ENTER];
  public readonly tagInputControl = new FormControl('');
  public readonly tagsSelected = signal<Tag[]>([]);

  private unsubscribeSubject = new Subject<void>();

  public constructor(@Optional() @Self() private ngControl: NgControl) {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }

    this.tagInputControl.valueChanges
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe((value) => {
        this.filteredOptions.next(this.filterTags(value));
      });

    addIcons({ addCircleOutline, closeOutline });
  }

  public ngOnInit() {
    // Only set from @Input if NOT using ControlValueAccessor (form control)
    // When using formControlName, writeValue() already sets the initial value
    if (this.tags && !this.ngControl) {
      this.tagsSelected.set(this.tags);
    }
    this.updateFilters();
  }

  public ngOnChanges(changes: SimpleChanges) {
    if (changes['tags']) {
      this.tagsSelected.set(this.tags);
    }
    this.updateFilters();
  }

  public onAddTag(event: MatAutocompleteSelectedEvent) {
    let tag = this.tagsAvailable.find(({ id }) => {
      return id === event.option.value;
    });

    if (!tag && this.hasPermissionToCreateTag) {
      tag = {
        id: undefined,
        name: event.option.value as string,
        userId: null
      };
    }

    this.tagsSelected.update((tags) => {
      return [...(tags ?? []), tag];
    });

    const newTags = this.tagsSelected();
    this.onChange(newTags);
    this.markAsDirty();
    this.onTouched();
    this.tagInput.nativeElement.value = '';
    this.tagInputControl.setValue(undefined);
  }

  public onRemoveTag(tag: Tag) {
    this.tagsSelected.update((tags) => {
      return tags.filter(({ id }) => {
        return id !== tag.id;
      });
    });

    const newTags = this.tagsSelected();
    this.onChange(newTags);
    this.markAsDirty();
    this.onTouched();
    this.updateFilters();
  }

  public registerOnChange(fn: (value: Tag[]) => void) {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean) {
    if (isDisabled) {
      this.tagInputControl.disable();
    } else {
      this.tagInputControl.enable();
    }
  }

  public writeValue(value: Tag[]) {
    this.tagsSelected.set(value || []);
    this.updateFilters();
  }

  public ngOnDestroy() {
    this.unsubscribeSubject.next();
    this.unsubscribeSubject.complete();
  }

  private markAsDirty(): void {
    this.ngControl?.control?.markAsDirty();
  }

  private filterTags(query: string = ''): Tag[] {
    const tags = this.tagsSelected() ?? [];
    const tagIds = tags.map(({ id }) => {
      return id;
    });

    return this.tagsAvailable.filter(({ id, name }) => {
      return (
        !tagIds.includes(id) && name.toLowerCase().includes(query.toLowerCase())
      );
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private onChange = (_value: Tag[]): void => {
    // ControlValueAccessor onChange callback
  };

  private onTouched = (): void => {
    // ControlValueAccessor onTouched callback
  };

  private updateFilters() {
    this.filteredOptions.next(this.filterTags());
  }
}
