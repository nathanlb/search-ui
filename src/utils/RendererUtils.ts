export class RendererUtils {
  static getElementFromTemplate(html: string) {
    const template = document.createElement('div');
    template.innerHTML = html.trim();
    return template.firstChild as HTMLElement;
  }
}